import test from 'node:test';
import assert from 'node:assert/strict';
import {VIEW_TILT,projectPoint,screenToWorld,drawArenaDepth,drawTop,floorOffset,drawBowlFloor} from '../depth-view.mjs';
const body={x:30,y:60,angle:1.2,region:{points:[[-1,-.6],[.7,-1],[1,.5],[-.4,1]]}};
function context(){
 const calls=[];
 const gradient={addColorStop(...args){calls.push(['colorStop',...args]);}};
 const ctx=new Proxy({},{get(_target,key){return (...args)=>{calls.push([key,...args]);return String(key).includes('Gradient')?gradient:undefined;};},set(_target,key,value){calls.push([key,typeof value==='object'?'gradient':value]);return true;}});
 return {ctx,calls};
}
test('projection preserves x and reverses ground points across the arena',()=>{
 assert.equal(VIEW_TILT,.78);
 for(const x of [-220,0,220])for(const y of [-220,0,220]){const point=screenToWorld(projectPoint({x,y}));assert.equal(point.x,x);assert.ok(Math.abs(point.y-y)<1e-10);}
 assert.deepEqual(projectPoint({x:10,y:100},8),{x:10,y:(100+floorOffset({x:10,y:100}))*.78-8});
});
test('arena depth and rotating tops issue finite balanced drawing operations without mutating bodies',()=>{
 const {ctx,calls}=context(),before=JSON.stringify(body);
 drawArenaDepth(ctx);drawTop(ctx,body,{color:'#71e6df',bounce:.8});
 assert.equal(JSON.stringify(body),before);
 assert.equal(calls.filter(c=>c[0]==='save').length,calls.filter(c=>c[0]==='restore').length);
 for(const call of calls)for(const value of call.slice(1))if(typeof value==='number')assert.ok(Number.isFinite(value),JSON.stringify(call));
 assert.ok(calls.some(c=>c[0]==='ellipse'));assert.ok(calls.some(c=>c[0]==='fill'));
});
test('reduced motion removes impact bounce and drawing is deterministic',()=>{
 const a=context(),b=context(),c=context();
 drawTop(a.ctx,body,{color:'#71e6df',bounce:1,reduced:true});
 drawTop(b.ctx,body,{color:'#71e6df',bounce:0,reduced:true});
 drawTop(c.ctx,body,{color:'#71e6df',bounce:1,reduced:true});
 assert.deepEqual(a.calls,b.calls);assert.deepEqual(a.calls,c.calls);
 const moving=context();drawTop(moving.ctx,body,{color:'#f6ce80',cpu:true,bounce:1});assert.notDeepEqual(a.calls,moving.calls);
});

test('bowl floor is deepest centrally, meets the rim, and stays level outside',()=>{
 assert.equal(floorOffset({x:0,y:0}),38);
 assert.equal(floorOffset({x:180,y:0}),0);
 assert.equal(floorOffset({x:200,y:50}),0);
 assert.equal(floorOffset({x:90,y:0}),28.5);
 for(let x=-220;x<=220;x+=22)for(let y=-220;y<=220;y+=11){
  const point=screenToWorld(projectPoint({x,y}));assert.ok(Math.abs(point.y-y)<1e-9);
 }
});
test('bowl drawing follows curved heights and tops contact their local floor',()=>{
 const {ctx,calls}=context();drawBowlFloor(ctx);drawTop(ctx,body,{color:'#71e6df'});
 assert.ok(calls.some(c=>c[0]==='translate'&&c[1]===body.x&&c[2]===body.y+floorOffset(body)));
 assert.equal(calls.filter(c=>c[0]==='save').length,calls.filter(c=>c[0]==='restore').length);
 for(const call of calls)for(const value of call.slice(1))if(typeof value==='number')assert.ok(Number.isFinite(value));
});
