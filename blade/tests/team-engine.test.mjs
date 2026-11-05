import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamMatch,launch,step,MATCH_SECONDS} from '../engine.mjs';
const city=(id,prefectureCode='27')=>({id,name:id,kind:'市',prefectureCode,prefecture:prefectureCode,points:[[-1,-1],[1,-1],[1,1],[-1,1]],grit:50,spinPower:50});
const teams=()=>[[city('a'),city('b'),city('c')],[city('d','13'),city('e','13'),city('f','13')]];
const active=()=>launch(createTeamMatch(...teams(),12),{x:0,y:-1},.75);
test('team composition requires three distinct municipalities from one prefecture',()=>{
 const [a,b]=teams();
 assert.throws(()=>createTeamMatch(a.slice(0,2),b));
 assert.throws(()=>createTeamMatch([a[0],a[0],a[2]],b));
 assert.throws(()=>createTeamMatch([a[0],city('other','01'),a[2]],b));
 assert.throws(()=>createTeamMatch([{...a[0],kind:'県'},a[1],a[2]],b));
 assert.throws(()=>createTeamMatch(a.map(r=>({...r,prefectureCode:undefined,prefecture:undefined})),b));
 const match=createTeamMatch(a,b);assert.equal(match.mode,'team');assert.equal(match.bodies.length,6);
 assert.deepEqual(match.bodies.map(b=>b.side),['player','player','player','cpu','cpu','cpu']);
 assert.equal(new Set(match.bodies.map(b=>`${b.x},${b.y}`)).size,6);
});
test('launch moves all teammates and immutable deterministic simulation finishes',()=>{
 const ready=createTeamMatch(...teams(),12),saved=JSON.stringify(ready),match=launch(ready,{x:0,y:-1},.75);
 assert.equal(JSON.stringify(ready),saved);assert.ok(match.bodies.slice(0,3).every(b=>b.vy<0));assert.ok(match.bodies.slice(3).every(b=>b.vy>0));
 let a=match,b=match;for(let i=0;i<600&&a.phase==='active';i++){a=step(a,.1);b=step(b,.1);}
 assert.deepEqual(a,b);assert.equal(a.phase,'finished');assert.ok(a.elapsed<=MATCH_SECONDS+.01);
 assert.ok(a.eliminations.length>0);assert.equal(new Set(a.eliminations.map(e=>e.index)).size,a.eliminations.length);
});
test('friendly collision changes momentum but causes no collision damage or critical',()=>{
 let m=active();m={...m,bodies:m.bodies.map((b,i)=>({...b,x:i===0?-10:i===1?10:120,y:i<2?0:100,vx:i===0?100:i===1?-100:0,vy:0,eliminated:i>1}))};
 const next=step(m,1/120),passive=1-(1/120)*.035*(1-.30*.5);
 assert.ok(next.bodies[0].vx<100);assert.ok(Math.abs(next.bodies[0].energy-passive)<1e-10);
 assert.ok(next.impacts.every(i=>!i.critical));assert.equal(next.criticalRng,m.criticalRng);
});
test('one elimination leaves battle active and emits one frozen body event',()=>{
 let m=active();m={...m,bodies:m.bodies.map((b,i)=>i===0?{...b,x:205,y:0}:b)};
 let next=step(m,1/120);assert.equal(next.phase,'active');assert.equal(next.bodies[0].eliminated,true);
 assert.equal(next.eliminations.length,1);assert.equal(next.eliminations[0].reason,'ringout');assert.equal(next.eliminations[0].index,0);
 const frozen=next.bodies[0];next=step(next,.1);assert.deepEqual(next.bodies[0],frozen);assert.equal(next.eliminations.length,1);
});
test('all three eliminated ends battle, including simultaneous raw energy tiebreak',()=>{
 let m=active();m={...m,bodies:m.bodies.map((b,i)=>i<3?{...b,energy:0}:b)};
 assert.equal(step(m,1/120).result.winner,'cpu');
 m=active();m={...m,bodies:m.bodies.map((b,i)=>({...b,energy:0,rawEnergy:i<3?-.1:-.2}))};
 const final=step(m,1/120);assert.equal(final.result.winner,'player');assert.equal(final.result.tiebreak,'remaining-energy');
});
test('timeout compares survivors then total energy and supports exact draw',()=>{
 let m=active();m={...m,elapsed:MATCH_SECONDS,bodies:m.bodies.map((b,i)=>({...b,eliminated:i===0}))};
 assert.equal(step(m,1/120).result.winner,'cpu');
 m={...active(),elapsed:MATCH_SECONDS};assert.equal(step(m,1/120).result.winner,'draw');
 m={...m,bodies:m.bodies.map((b,i)=>({...b,energy:i<3?.4:.8}))};assert.equal(step(m,1/120).result.winner,'cpu');
});
test('team collisions attach global attacker indices, remain finite and never mutate inputs',()=>{
 let m=active();m={...m,criticalRng:1,bodies:m.bodies.map((b,i)=>({...b,x:i===2?-10:i===5?10:100,y:i===2||i===5?0:100,vx:i===2?200:i===5?-200:0,vy:0,eliminated:i!==2&&i!==5}))};
 const original=JSON.stringify(m),next=step(m,1/120);assert.equal(JSON.stringify(m),original);
 assert.ok(next.impacts.length);assert.ok(next.impacts.every(p=>p.criticalAttackers.every(i=>i===2||i===5)));
 assert.ok(next.bodies.every(b=>Number.isFinite(b.energy)&&Number.isFinite(b.x)));
 assert.equal(step(next,NaN),next);
});
test('team critical uses global indices and independent contact episodes',()=>{
 let seed=0;while(((Math.imul(seed,1664525)+1013904223)>>>0)/4294967296>=.08)seed++;
 let m=active();m={...m,criticalRng:seed,bodies:m.bodies.map((b,i)=>({...b,x:i===2?-10:i===5?10:100,y:i===2||i===5?0:100,vx:i===2?200:i===5?-200:0,vy:0,eliminated:i!==2&&i!==5}))};
 const next=step(m,1/120);assert.ok(next.impacts.some(p=>p.criticalAttackers.includes(2)));
 assert.equal(next.criticalContacts['2:5'].spent,true);assert.equal(next.criticalContacts['0:3'],undefined);
 const near={...next,bodies:next.bodies.map((b,i)=>i===2?{...b,x:-10,vx:200}:i===5?{...b,x:10,vx:-200}:b)};
 const repeated=step(near,1/120);assert.equal(repeated.criticalRng,next.criticalRng);
 const separated={...repeated,bodies:repeated.bodies.map((b,i)=>i===2?{...b,x:-100,vx:0}:i===5?{...b,x:100,vx:0}:b)};
 assert.equal(step(separated,.1).criticalContacts['2:5'].spent,false);
});
test('simultaneous ringouts draw regardless of overkill and prior losses cannot skew last blow',()=>{
 let m=active();m={...m,bodies:m.bodies.map((b,i)=>({...b,x:205,y:0,rawEnergy:i<3?-.1:-.4}))};
 assert.deepEqual(step(m,1/120).result,{winner:'draw',reason:'ringout'});
 m=active();m={...m,bodies:m.bodies.map((b,i)=>({...b,eliminated:i!==2&&i!==5,energy:0,rawEnergy:i===2?-.2:i===5?-.1:-100}))};
 assert.equal(step(m,1/120).result.winner,'cpu');
 m={...m,bodies:m.bodies.map(b=>({...b,rawEnergy:-.1}))};assert.equal(step(m,1/120).result.winner,'draw');
});
test('team readiness is inert and malformed direction/power is rejected',()=>{
 const m=createTeamMatch(...teams());assert.equal(step(m,.1),m);assert.throws(()=>launch(m,{x:NaN,y:0},1));assert.throws(()=>launch(m,{x:0,y:-1},NaN));
 const launched=launch(m,{x:0,y:0},2);assert.equal(launch(launched,{x:0,y:-1},1),launched);
 assert.ok(launched.bodies.slice(0,3).every(b=>b.vy===-240));
});
