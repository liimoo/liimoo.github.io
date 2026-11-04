import test from 'node:test';
import assert from 'node:assert/strict';
import { hull, createMatch, launch, step } from '../engine.mjs';
const square = { id: 'square', points: [[-0.7,-0.7],[0.7,-0.7],[0.7,0.7],[-0.7,0.7]] };
const long = { id: 'long', points: [[-1,-0.25],[1,-0.25],[1,0.25],[-1,0.25]] };
test('hull removes interior, duplicate and collinear points', () => {
 assert.equal(hull([[0,0],[1,0],[1,1],[0,1],[.5,.5],[0,0],[.5,0]]).length,4);
 assert.throws(()=>createMatch({points:[[0,0]]}, square), /polygon/i);
});
test('ready state has equal mass and is not advanced', () => {
 const m=createMatch(square,long); assert.equal(m.phase,'ready');
 assert.equal(m.bodies[0].mass,m.bodies[1].mass);
 assert.equal(m.bodies[0].y,95); assert.equal(m.bodies[1].y,-95);
 assert.deepEqual(step(m,.1),m);
});
test('launch is immutable, deterministic and power bounded',()=>{
 const m=createMatch(square,long,12); const a=launch(m,{x:0,y:-1},100);
 assert.equal(m.phase,'ready'); assert.equal(a.phase,'active');
 assert.deepEqual(a,launch(m,{x:0,y:-1},100));
 assert.ok(Math.hypot(a.bodies[0].vx,a.bodies[0].vy)<=340);
 assert.deepEqual(launch(a,{x:1,y:0},1),a);
});
test('ringout, spin loss, simultaneous loss and timeout produce explicit results',()=>{
 const a=launch(createMatch(square,square),{x:0,y:-1},.5);
 const update=(bodies,elapsed=0)=>step({...a,bodies,elapsed},1/120).result;
 assert.deepEqual(update(a.bodies.map((b,i)=>({...b,x:i?0:200}))),{winner:'cpu',reason:'ringout'});
 assert.deepEqual(update(a.bodies.map((b,i)=>({...b,energy:i?1:0}))),{winner:'cpu',reason:'spin'});
 assert.deepEqual(update(a.bodies.map(b=>({...b,energy:0}))),{winner:'draw',reason:'spin'});
 assert.deepEqual(update(a.bodies,45),{winner:'draw',reason:'time'});
});
test('actual SAT shapes separate collisions and generate contact flash',()=>{
 let a=launch(createMatch(square,square),{x:0,y:-1},1);
 a={...a,bodies:a.bodies.map((b,i)=>({...b,x:i?16:-16,y:0,vx:i?-40:40,vy:0,angle:0}))};
 const out=step(a,1/120);
 assert.ok(out.impacts.length>0);
 assert.ok(out.bodies[0].vx<0 && out.bodies[1].vx>0);
 assert.ok(out.bodies[0].x < a.bodies[0].x);
 assert.equal(a.impacts.length,0);
});
test('long thin polygons do not collide merely because bounding circles overlap',()=>{
 let a=launch(createMatch(long,long),{x:0,y:-1},1);
 a={...a,bodies:a.bodies.map((b,i)=>({...b,x:0,y:i?20:-20,vx:0,vy:0,angle:0}))};
 assert.equal(step(a,1/120).impacts.length,0);
});
test('simulation remains finite and reproducible across seeds and long runs',()=>{
 for(let seed=1;seed<=16;seed++){
 let a=launch(createMatch(square,long,seed),{x:.3,y:-1},.85);
 let b=launch(createMatch(square,long,seed),{x:.3,y:-1},.85);
 for(let n=0;n<5500;n++) {a=step(a,1/120);b=step(b,1/120);}
 assert.deepEqual(a,b); assert.equal(a.phase,'finished');
 for(const body of a.bodies) for(const key of ['x','y','vx','vy','angle','spin','energy']) assert.ok(Number.isFinite(body[key]));
 }
});
test('invalid time and invalid input cannot poison state',()=>{
 const a=createMatch(square,square); assert.deepEqual(step(a,NaN),a);
 assert.throws(()=>launch(a,{x:NaN,y:0},1),/direction/);
 assert.throws(()=>launch(a,{x:0,y:-1},NaN),/power/);
});

test('initially stationary tops converge and finish with finite state',()=>{
 let a=launch(createMatch(square,long),{x:0,y:-1},0);
 a={...a,bodies:a.bodies.map(b=>({...b,vx:0,vy:0}))};
 for(let n=0;n<5401;n++) a=step(a,1/120);
 assert.equal(a.phase,'finished');
 assert.ok(a.elapsed>0 && a.elapsed<=45.02);
 assert.ok(a.bodies.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.spin)));
});
test('off-centre angular contacts obey the speed cap immediately',()=>{
 let a=launch(createMatch(long,square),{x:0,y:-1},1);
 a={...a,bodies:a.bodies.map((b,i)=>({...b,x:i?15:-15,y:i?8:-8,vx:i?-330:330,vy:0,spin:i?-24:24,angle:.2}))};
 a=step(a,1/120);
 assert.ok(a.bodies.every(b=>Math.hypot(b.vx,b.vy)<=340+1e-8));
});
test('shallow bowl brings a freely moving top back toward the arena centre',()=>{
 let a=launch(createMatch(square,long),{x:0,y:-1},.5);
 a={...a,bodies:[{...a.bodies[0],x:120,y:0,vx:0,vy:0},{...a.bodies[1],x:-120,y:0,vx:0,vy:0}]};
 const b=step(a,.1);
 assert.ok(b.bodies[0].vx<0 && b.bodies[1].vx>0);
 assert.ok(b.bodies[0].x<120);
});
test('ordinary launch angles permit multiple seconds of play instead of instant ringout',()=>{
 let surviving=0;
 for(let seed=1;seed<=20;seed++) {
 const angle=(seed-10)*.06;
 let a=launch(createMatch(square,long,seed),{x:Math.sin(angle),y:-Math.cos(angle)},.8);
 for(let frame=0;frame<600&&a.phase==='active';frame++) a=step(a,1/120);
 if(a.elapsed>=4.99) surviving++;
 }
 assert.ok(surviving>=16,`Only ${surviving} matches survived five seconds`);
});
test('real-region sample supports short multi-contact matches',async()=>{
 const {readFile}=await import('node:fs/promises');
 const regions=JSON.parse(await readFile(new URL('../regions.json',import.meta.url),'utf8'));
 const durations=[],gaps=[];
 let contacts=0,lateFrames=0,lateSpinning=0;
 for(let n=0;n<100;n++) {
  const angle=((n*137.5%80)-40)*Math.PI/180;
  let a=launch(createMatch(regions[n%regions.length],regions[(n*7+3)%regions.length],n+1),
   {x:Math.sin(angle),y:-Math.cos(angle)},.3+(n*19%70)/100);
  let lastContact=0,maxGap=0;
  for(let f=0;f<5500&&a.phase==='active';f++) {
   a=step(a,1/120);
   if(a.impacts.some(p=>p.age===0)) {
    contacts++;
    maxGap=Math.max(maxGap,a.elapsed-lastContact);
    lastContact=a.elapsed;
   }
   for(const body of a.bodies) if(body.energy>0 && body.energy<.25) {
    lateFrames++;
    if(Math.abs(body.spin)>=7) lateSpinning++;
   }
  }
  assert.equal(a.phase,'finished'); durations.push(a.elapsed);
  gaps.push(Math.max(maxGap,a.elapsed-lastContact));
  if(a.result.reason==='spin') {
   const losers=a.result.winner==='draw'?a.bodies:
    [a.bodies[a.result.winner==='cpu'?0:1]];
   assert.ok(losers.every(body=>body.energy===0),'Defeated body must have an empty gauge');
  }
 }
 durations.sort((a,b)=>a-b);
 gaps.sort((a,b)=>a-b);
 assert.ok(gaps[90]<4,`Long contact-free orbit: ${gaps[90]}`);
 assert.ok(durations[50]>8 && durations[50]<25,`Median duration ${durations[50]}`);
 assert.ok(durations[10]>4,`Too many instant losses: ${durations[10]}`);
 assert.ok(contacts>500,`Insufficient repeated contact: ${contacts}`);
 assert.ok(lateFrames>0 && lateSpinning/lateFrames>.9,'Endgame rotation must remain lively');
});
test('asymmetric angular contact causes individual stamina damage',()=>{
 let a=launch(createMatch(long,square),{x:0,y:-1},1);
 a={...a,bodies:a.bodies.map((b,i)=>({...b,x:i?15:-15,y:i?8:-8,vx:0,vy:i?-60:60,spin:i?-2:2,angle:i?.5:.2}))};
 const b=step(a,1/120);
 assert.ok(b.impacts.length>0);
 assert.ok(Math.abs(b.bodies[0].energy-b.bodies[1].energy)>.001);
 assert.ok(b.bodies.every(v=>v.energy<1 && v.energy>=0));
});
test('low stamina preserves visible rotation until exhaustion',()=>{
 const a=launch(createMatch(square,long),{x:0,y:-1},.5);
 const b=step({...a,bodies:a.bodies.map((body,i)=>({...body,
  x:i?120:-120,y:0,vx:0,vy:0,energy:.005}))},.1);
 assert.equal(b.phase,'active');
 assert.ok(b.bodies.every(body=>Math.abs(body.spin)>=10));
 assert.ok(b.bodies.every(body=>body.energy>0 && body.energy<.005));
});
test('nearly stopped tops recover rotation and travel while stamina remains',()=>{
 let a=launch(createMatch(square,long),{x:0,y:-1},.5);
 a={...a,bodies:a.bodies.map((b,i)=>({...b,x:i?120:-120,y:0,
  vx:0,vy:0,spin:0,energy:.3}))};
 for(let frame=0;frame<30;frame++) a=step(a,1/120);
 assert.equal(a.phase,'active');
 assert.ok(a.bodies.every(b=>Math.abs(b.spin)>7));
 assert.ok(a.bodies.every(b=>Math.hypot(b.vx,b.vy)>70));
});

test('remaining stamina prevents defeat even when rotation stops or reverses',()=>{
 for(const spin of [0,.01,-.05]) {
  const a=launch(createMatch(square,long),{x:0,y:-1},.5);
  const b=step({...a,bodies:a.bodies.map((body,i)=>({...body,
   x:i?120:-120,y:0,vx:0,vy:0,spin,energy:i?.8:.4}))},.1);
  assert.equal(b.phase,'active');
  assert.equal(b.result,null);
  assert.ok(b.bodies.every(body=>body.energy>0));
 }
});
test('passive stamina reaching zero ends the match with an empty losing gauge',()=>{
 const a=launch(createMatch(square,long),{x:0,y:-1},.5);
 const b=step({...a,bodies:a.bodies.map((body,i)=>({...body,
  x:i?120:-120,y:0,vx:0,vy:0,energy:i?.8:.001}))},.1);
 assert.deepEqual(b.result,{winner:'cpu',reason:'spin'});
 assert.equal(b.bodies[0].energy,0);
 assert.equal(b.bodies[0].spin,0);
 assert.ok(b.bodies[1].energy>0);
});

test('rotation recovery is gradual and zero-speed centre remains finite',()=>{
 const a=launch(createMatch(square,long),{x:0,y:-1},.5);
 const b=step({...a,bodies:a.bodies.map((body,i)=>({...body,
  x:i?120:0,y:0,vx:0,vy:0,spin:i?13:-13}))},1/120);
 assert.ok(b.bodies[0].spin>-13 && b.bodies[0].spin<-10);
 assert.ok(b.bodies[1].spin<13 && b.bodies[1].spin>10);
 assert.ok(b.bodies.every(body=>Number.isFinite(body.vx)&&Number.isFinite(body.vy)));
 assert.ok(Math.hypot(b.bodies[0].vx,b.bodies[0].vy)>0);
});
