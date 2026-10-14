import {test} from "node:test";
import assert from "node:assert/strict";
import {browseResponses,responseGroups,type ResponseOption} from "./responseBrowsing";
function option(key:string, opponent?: string, shared = false, scores = [10,20]): ResponseOption {return {key,label:key,evidence:{node:1,path:[1],strategy:"s",milestones:[],scores,opponent,shared}};}
test("opponent ranges exclude baseline and duplicated worst shortcuts; common membership is required", () => {
  const options = [option("baseline"),option("worst","a",true),option("a1","a",true),option("a2","a",true,[30,20]),option("b","b",true)];
  assert.deepEqual(responseGroups(options,["a"]),[{opponent:"a",count:2,commonCount:2,min:-10,max:10},{opponent:"b",count:1,commonCount:0,min:-10,max:-10}]);
  assert.deepEqual(browseResponses(options,["a"],"common","","original").map(x=>x.key),["a1","a2"]);
  assert.deepEqual(browseResponses(options,["a"],"exploratory","","original").map(x=>x.key),["b"]);
});
test("sorting preserves identities and input; selected evidence can remain outside local result set",()=>{
  const options = [option("baseline",undefined,false,[30,10]),option("a","a",true),option("b","b",true,[0,20])];
  assert.deepEqual(browseResponses(options,["a","b"],"all","","margin").map(x=>x.key),["b","a","baseline"]);
  assert.deepEqual(options.map(x=>x.key),["baseline","a","b"]);
  assert.deepEqual(browseResponses(options,["a","b"],"negative","a","margin").map(x=>x.key),["a"]);
  assert.equal(browseResponses(options,[],"blocked","","original").length,0);
});
