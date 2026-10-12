import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from './plans.ts';
import { opponents, responseGroup } from './decisions.ts';
import { simulate } from '../simulation/engine.js';
import { planMovement } from '../simulation/movement.js';
import { startPosition, transfer, builderTransfer } from '../simulation/field.js';
test('canonical policies partition all 441 settings and equivalent members produce identical runs',()=>{
 const plans=catalog(), groups=opponents();
 assert.equal(new Set(groups.flatMap(g=>g.ids)).size,441);
 for(const g of groups){
  const expected=simulate(plans[0],g.plan,{},false).scores;
  for(const id of g.ids){const p=plans.find(p=>p.id===id);assert.equal(responseGroup(p).key,responseGroup(g.plan).key);assert.deepEqual(simulate(plans[0],p,{},false).scores,expected);}
 }
});
test('both access choices reach the transfer area and change distance for each robot',()=>{
 for(const team of [0,1])for(const role of ['TR','BR']){
  const paths=['ramp','stairs'].map(access=>planMovement({team,role,access,p:startPosition(team,role)},role==='TR'?transfer(team):builderTransfer(team)));
  assert.notEqual(paths[0].distance,paths[1].distance);
  assert(paths[0].route.some(p=>Math.abs(p[2]+2.694)<.001));
  assert(paths[1].route.some(p=>p[1]===.15));
  if(role==='TR')for(const path of paths)assert(path.route.every(p=>p[1]<=.6));
 }
});
test('no-mustika candidate never tries to collect or place it; route selection does not mutate baseline',()=>{
 const baseline=catalog()[0], candidate={...baseline,mission:false,access:{BR:'ramp',TR:'stairs'}};
 const run=simulate(candidate,baseline);
 assert(!run.events.some(e=>e.team===0&&/ムスティカを(回収|設置)/.test(e.label)));
 assert.equal(baseline.access,undefined);assert.equal(baseline.mission,true);
});
