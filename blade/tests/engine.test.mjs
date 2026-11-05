import test from 'node:test';
import assert from 'node:assert/strict';
import { hull, createMatch, launch, step, regionStats, combatBonuses } from '../engine.mjs';
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
 a={...a,bodies:a.bodies.map((b,i)=>({...b,x:i?15:-15,y:i?8:-8,vx:i?-40:40,vy:0,angle:i?0:.2}))};
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

test('opposite and zero rotation recover in the launch direction without a stall',()=>{
 const a=launch(createMatch(square,long),{x:0,y:-1},.5);
 for(const initial of [0,-13]) {
  const input={...a,bodies:a.bodies.map((body,i)=>({...body,
   x:i?120:0,y:0,vx:0,vy:0,spin:i?-initial:initial}))};
  const snapshot=structuredClone(input),b=step(input,1/120);
  assert.deepEqual(input,snapshot);
  assert.ok(b.bodies[0].spin>=8 && b.bodies[1].spin<=-8);
  assert.ok(b.bodies.every(body=>Number.isFinite(body.vx)&&Number.isFinite(body.vy)));
 }
});
test('every live top keeps rotating through contacts across all region pairs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const regions=JSON.parse(await readFile(new URL('../regions.json',import.meta.url),'utf8'));
 for(let p=0;p<regions.length;p++) for(let c=0;c<regions.length;c++)
 for(const angle of [-.6,0,.6]) {
  let a=launch(createMatch(regions[p],regions[c],p*31+c+1),
   {x:Math.sin(angle),y:-Math.cos(angle)},.7);
  for(let f=0;f<5500&&a.phase==='active';f++) {
   a=step(a,1/120);
   for(const b of a.bodies) {
    if(b.energy<=0) assert.equal(b.spin,0);
    else assert.ok(b.spin*Math.sign(b.cruiseSpin)>=8 && Math.abs(b.spin)<=24,
     `${b.region.name} stalled against ${regions[c].name} at ${a.elapsed}s: ${b.spin}`);
   }
  }
  assert.equal(a.phase,'finished');
 }
});


test('grit is a bounded shape statistic with validated explicit overrides',()=>{
 assert.equal(regionStats({...square,grit:0}).grit,0);
 assert.equal(regionStats({...square,grit:100}).grit,100);
 assert.equal(regionStats(square).grit,100);
 const irregular={points:[[-1,0],[0,.1],[.1,0],[0,-.1]]};
 assert.ok(regionStats(irregular).grit<regionStats(square).grit);
 for(const grit of [-1,101,NaN,Infinity,'50',null])
  assert.throws(()=>regionStats({...square,grit}),/grit/i);
 assert.throws(()=>regionStats({points:[[0,0]]}),/polygon/i);
});
test('full gauges share resistance and inertia; grit rises only as stamina falls',()=>{
 const m=createMatch({...square,grit:0},{...long,grit:100});
 assert.equal(m.bodies[0].inertia,400);
 assert.equal(m.bodies[1].inertia,400);
 for(const body of m.bodies) assert.deepEqual(combatBonuses(body),{attack:1,resistance:1});
 for(const [energy,expected] of [[1,1],[.5,1.5],[.1,1.9],[0,2],[-1,2],[2,1]]) {
  assert.deepEqual(combatBonuses({...m.bodies[1],energy}),{attack:expected,resistance:expected});
  assert.deepEqual(combatBonuses({...m.bodies[0],energy}),{attack:1,resistance:1});
 }
 assert.deepEqual(combatBonuses({...m.bodies[1],grit:50,energy:.5}),{attack:1.25,resistance:1.25});
});

function gritContact(grit,energy=.3) {
 const a=launch(createMatch({...square,grit},{...square,grit:0}),{x:0,y:-1},1);
 return {...a,bodies:a.bodies.map((b,i)=>({...b,x:i?20:-20,y:i?3:-3,
  vx:i?-20:20,vy:0,angle:0,spin:i?-10:10,cruiseSpin:i?-10:10,energy}))};
}
test('grit reduces own contact torque and increases opponent stamina damage without extra knockback',()=>{
 const low=gritContact(0),high=gritContact(100),snapshot=structuredClone(high);
 const a=step(low,1/120),b=step(high,1/120);
 assert.ok(a.impacts.length && b.impacts.length);
 assert.ok(b.bodies[0].energy>a.bodies[0].energy,'resistance reduces own torque damage');
 assert.ok(b.bodies[1].energy<a.bodies[1].energy,'attack increases opposing damage');
 assert.ok(Math.abs(b.bodies[0].spin-10)<Math.abs(a.bodies[0].spin-10),'resistance reduces rotation disturbance');
 for(let i=0;i<2;i++) for(const key of ['vx','vy','x','y']) assert.equal(a.bodies[i][key],b.bodies[i][key]);
 assert.deepEqual(high,snapshot);
});
