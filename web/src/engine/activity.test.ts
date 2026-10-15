import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ActivityTrace, ACTIVITY_NODE_LIMIT, ACTIVITY_EDGE_LIMIT } from "./activity";
import { defaults } from "./model";
import { Store } from "./store";
import { DiscoveryEngine } from "./discovery";
import { Runtime } from "./runtime";
import { Persistence, exportSearch } from "./persistence";
import type { JobActivity, JobProgress } from "./types";
const progress: JobProgress = {kind:"exact", phase:"computing",elapsed:1,secondsLimit:null, unitsDone:0,unitsLimit:100,savedAt:null,saveState:"unsaved",stopReason:null};

test("recent work remains bounded and never retains dangling or invented edges", () => {
  const trace = new ActivityTrace("exact");
  const node = (n:number) => ({ id:`e:${n}`,node:n,run:0,time:n });
  for (let i=0;i<1000;i++) { trace.visit(node(i)); trace.connect(node(i),node(i+1)); }
  const snapshot = trace.snapshot(progress,null), ids = new Set(snapshot.nodes.map(n=>n.id));
  assert.equal(snapshot.unitsDone,1000);
  assert.equal(snapshot.nodes.length,ACTIVITY_NODE_LIMIT);
  assert.ok(snapshot.edges.length<=ACTIVITY_EDGE_LIMIT);
  assert.ok(snapshot.edges.every(e=>ids.has(e.src)&&ids.has(e.dst)&&Number(e.dst.slice(2))===Number(e.src.slice(2))+1));
  trace.visit(node(1001));
  assert.equal(snapshot.nodes.at(-1)?.node,1000,"published snapshots remain immutable");
});

test("exact and discovery traces match their actual distinct graph identities", () => {
  const exact = Store.create(defaults()); exact.activity = new ActivityTrace("exact");
  while (!exact.activity.units) exact.batch(2);
  const e = exact.activity.snapshot(progress,null);
  assert.ok(e.edges.length);
  assert.ok(e.edges.every(link=>exact.data.edges.some(edge=>`e:${edge.src}`===link.src&&`e:${edge.dst}`===link.dst)));
  const discovered = Store.create(defaults()); discovered.activity = new ActivityTrace("discovery");
  const engine = new DiscoveryEngine(discovered);
  for(let i=0;i<100;i++) engine.tick();
  const d = discovered.activity.snapshot({...progress,kind:"discovery"},null);
  assert.ok(d.edges.length);
  assert.ok(d.nodes.every(n=>n.id.startsWith("d:")&&engine.d.nodes[Number(n.id.slice(2))-1].node===n.node));
  assert.ok(d.edges.every(link=>engine.d.links.some(edge=>`d:${edge.src}`===link.src&&`d:${edge.dst}`===link.dst)));
  assert.equal("activity" in exportSearch(discovered).search,false);
});

test("runtime emits lightweight frequent activity, stops after cancellation, and resets on restart", async () => {
  const db = new Persistence(crypto.randomUUID()), rt = new Runtime(db);
  const search = await rt.call("search.create",{config:defaults()});
  const events:JobActivity[]=[];
  rt.subscribe(e=>{if(e.type==="job.activity") events.push(e.activity);});
  await rt.call("job.start",{search:search.id,kind:"discovery",seconds:10});
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("Expected at least two computing activity samples within 8 seconds"));
      }, 8000);
      const unsubscribe = rt.subscribe(event => {
        if (event.type === "job.activity" && event.activity.phase === "computing" &&
            events.filter(sample => sample.phase === "computing").length >= 2) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  } finally {
    await rt.pause(search.id);
  }
  assert.equal(events[0].phase,"starting");
  assert.ok(events.filter(e=>e.phase==="computing").length>=2);
  assert.equal(events.at(-1)?.phase,"finished");
  assert.ok(events.some(e=>e.edges.length>0));
  assert.ok(events.every(e=>!("discovery" in e)));
  const count=events.length;
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(events.length,count);
  assert.equal((await db.load(search.id)).activity,undefined);
  await rt.call("job.start",{search:search.id,kind:"exact",budget:1});
  await rt.wait(search.id);
  assert.equal(events[count].sequence,1);
  assert.equal(events[count].nodes.length,0);
  assert.equal(events.at(-1)?.unitsDone,1);
  await db.close();
});

test("evaluation activity reports actual stage counts with no traversal or invented rate", async () => {
  const db = new Persistence(crypto.randomUUID()), rt = new Runtime(db);
  const search = await rt.call("search.create",{config:{...defaults(),horizon:2}});
  const events:JobActivity[]=[];
  rt.subscribe(e=>{if(e.type==="job.activity") events.push(e.activity);});
  await rt.call("job.start",{search:search.id,kind:"evaluation"});
  await rt.wait(search.id);
  const last=events.at(-1)!;
  assert.equal(last.kind,"evaluation");
  assert.equal(last.evaluation?.phase,"complete");
  assert.equal(last.unitsDone,last.evaluation?.done);
  assert.equal(last.unitsPerSecond,0);
  assert.deepEqual(last.edges,[]);
  assert.equal((await rt.get(search.id)).activity,undefined);
  await db.close();
});
