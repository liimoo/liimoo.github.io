import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinishEffect,advanceFinishEffect,hiddenByFinish} from '../finish-effects.mjs';
const bodies=[{side:'player',x:10,y:20,angle:1},{side:'cpu',x:-20,y:30,angle:2}];
const match=(winner='player',reason='spin')=>({bodies,result:{winner,reason}});
test('only the defeated map shatters and source state stays unchanged',()=>{
 const m=match(),copy=structuredClone(m),fx=createFinishEffect(m);
 assert.deepEqual(fx.losers,[1]);
 assert.deepEqual(createFinishEffect(match('cpu')).losers,[0]);
 assert.deepEqual(createFinishEffect(match('player','ringout')).losers,[1]);
 assert.deepEqual(m,copy);
 assert.equal(hiddenByFinish(fx,1),false);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.2),1),true);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.2),0),false);
});
test('simultaneous defeat breaks both maps but timeout breaks neither',()=>{
 assert.deepEqual(createFinishEffect(match('draw')).losers,[0,1]);
 assert.deepEqual(createFinishEffect(match('draw','ringout')).losers,[0,1]);
 assert.deepEqual(createFinishEffect(match('draw','time')).losers,[]);
});
test('result waits for finite effect duration with immutable progression',()=>{
 const fx=createFinishEffect(match());
 const next=advanceFinishEffect(fx,.5);
 assert.equal(fx.age,0);assert.equal(next.done,false);
 assert.equal(advanceFinishEffect(next,1).done,true);
 assert.equal(advanceFinishEffect(next,1).age,fx.duration);
 assert.deepEqual(advanceFinishEffect(fx,NaN),fx);
 assert.deepEqual(advanceFinishEffect(fx,-1),fx);
});
test('reduced motion uses a short fade with no shattered map replacement',()=>{
 const fx=createFinishEffect(match(),true);
 assert.ok(fx.duration<.5);assert.equal(fx.reduced,true);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.2),1),false);
 assert.equal(advanceFinishEffect(fx,.5).done,true);
});
test('effect rendering stays finite with balanced canvas state at every phase',async()=>{
 const {drawFinishEffect,finishShake}=await import('../finish-effects.mjs');
 const maps=bodies.map(b=>({...b,region:{points:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]}}));
 let depth=0,calls=0;
 const ctx=new Proxy({}, {
  set(target,key,value){
   if(key==='globalAlpha')assert.ok(value>=0&&value<=1);
   if(key==='lineWidth')assert.ok(value>0);
   target[key]=value;return true;
  },
  get(target,key){
   if(key==='createRadialGradient')return ()=>({addColorStop(){}});
   return (...args)=>{
    calls++;
    for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));
    if(key==='save')depth++;
    if(key==='restore')depth--;
    assert.ok(depth>=0);
    if(key==='arc')assert.ok(args[2]>=0);
   };
  }
 });
 assert.deepEqual(finishShake(null),{x:0,y:0});
 drawFinishEffect(ctx,null,maps);
 for(const reduced of [false,true])for(const age of [0,.05,.1,.4,.95,1.15]) {
  const fx=advanceFinishEffect(createFinishEffect(match('draw'),reduced),age);
  drawFinishEffect(ctx,fx,maps);
  assert.equal(depth,0);
  const shake=finishShake(fx);
  assert.ok(Math.abs(shake.x)<=5&&Math.abs(shake.y)<=5);
  if(reduced)assert.deepEqual(shake,{x:0,y:0});
 }
 assert.ok(calls>0);
});
