import test from 'node:test';
import assert from 'node:assert/strict';
import {createBladeTelemetry} from '../telemetry.mjs';
const uuid='00000000-0000-4000-8000-000000000001';
const selection={mode:'team',player_regions:['a','b','c'],cpu_regions:['d','e','f']};
const result={winner:'player',reason:'spin',duration:12};
function setup(fetcher){const calls=[];return {calls,client:createBladeTelemetry({uuid:()=>uuid,fetch:async(url,options)=>{calls.push({url,...options,body:JSON.parse(options.body)});return fetcher?fetcher(calls.length,options):{ok:true,status:200};},timeoutMs:10})};}
test('does not send before start; sends six IDs without persistent identity and finishes once',async()=>{
 const {client,calls}=setup();assert.equal(calls.length,0);
 const match=client.start(selection);await match.finish(result);await match.finish(result);
 assert.equal(calls.length,2);assert.deepEqual(calls[0].body,{event:'start',match_id:uuid,...selection});
 assert.deepEqual(calls[1].body,{event:'finish',match_id:uuid,...result});
 assert.equal(calls[0].keepalive,true);assert.equal(calls[0].credentials,'omit');
});
test('finish waits for start and retries network and 5xx with the same UUID',async()=>{
 let release;const {client,calls}=setup(n=>n===1?new Promise(resolve=>{release=resolve;}):{ok:true,status:200});
 const match=client.start(selection);const done=match.finish(result);assert.equal(calls.length,1);
 release({ok:true,status:200});await done;assert.equal(calls.length,2);
 for(const failure of [()=>{throw Error('offline');},()=>({ok:false,status:503})]){
  const run=setup(n=>n===1?failure():{ok:true,status:200});await run.client.start(selection).finish(result);
  assert.equal(run.calls.length,3);assert.equal(run.calls[0].body.match_id,run.calls[1].body.match_id);
 }
});
test('4xx does not retry or send orphan finish',async()=>{
 const {client,calls}=setup(()=>({ok:false,status:400}));await client.start(selection).finish(result);assert.equal(calls.length,1);
});
test('timeout is bounded and failed start suppresses finish',async()=>{
 const {client,calls}=setup(()=>new Promise(()=>{}));await client.start(selection).finish(result);assert.equal(calls.length,2);assert(calls.every(c=>c.signal.aborted));
});
test('finish failure retries once, multiple finish calls share completion',async()=>{
 const {client,calls}=setup(n=>({ok:n===1,status:n===1?200:500}));const match=client.start(selection);
 const first=match.finish(result);assert.equal(first,match.finish(result));await first;assert.equal(calls.length,3);
});
test('fresh matches have fresh IDs and snapshot arrays; unavailable UUID fails safely',async()=>{
 let count=0;const calls=[];const client=createBladeTelemetry({uuid:()=>String(++count),fetch:async(u,o)=>{calls.push(JSON.parse(o.body));return {ok:true};}});
 const first=client.start(selection);const second=client.start({...selection,mode:'pref-team'});await Promise.all([first.finish(result),second.finish(result)]);
 assert.notEqual(calls[0].match_id,calls[1].match_id);
 const broken=createBladeTelemetry({uuid:()=>{throw Error('unavailable');}});await broken.start(selection).finish(result);
});
