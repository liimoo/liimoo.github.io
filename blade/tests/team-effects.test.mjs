import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamEffects,collectTeamEffects,advanceTeamEffects,teamBody,teamHidden,teamFinishDone,drawTeamEffects} from '../team-effects.mjs';
import {createTeamMatch,launch,step} from '../engine.mjs';
const region={points:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]};
const bodies=Array.from({length:6},(_,index)=>({region,side:index<3?'player':'cpu',x:index*8,y:20,angle:1,spin:12,vx:30,vy:10,energy:1}));
const event=(index,reason='spin',id=index)=>({id,index,reason,body:{...bodies[index],spin:0,energy:0,eliminated:true},previousBody:bodies[index]});
const match=(eliminations=[],result=null)=>({bodies:bodies.map((body,index)=>eliminations.some(e=>e.index===index)?{...body,eliminated:true}:body),eliminations,result});
const advance=(state,dt)=>advanceTeamEffects(state,dt).state;
test('individual defeats animate without moving survivors and are collected once',()=>{
 const m=match([event(4)]),snapshot=structuredClone(m),initial=createTeamEffects();
 const fx=collectTeamEffects(initial,m);
 assert.deepEqual(initial,createTeamEffects());assert.deepEqual(m,snapshot);
 assert.deepEqual(collectTeamEffects(fx,m),fx);
 assert.deepEqual(teamBody(fx,0,bodies[0]),bodies[0]);
 const at=t=>teamBody(advance(fx,t),4,bodies[4]);
 assert.ok(at(.1).angle>at(0).angle);
 assert.equal(at(.45).angle,at(.6).angle);
 assert.equal(teamHidden(advance(fx,.6),4),false);
 assert.equal(teamHidden(advance(fx,.7),4),true);
 assert.equal(teamFinishDone(advance(fx,5),m),false);
});
test('ringout and visible burst cues are emitted only once',()=>{
 const e={...event(3,'ringout'),body:{...event(3).body,x:189,y:0,vx:0}};
 let fx=collectTeamEffects(createTeamEffects(),match([e]));
 let tick=advanceTeamEffects(fx,.2);assert.deepEqual(tick.cues,['ringout']);
 assert.ok(teamBody(tick.state,3,bodies[3]).x>189);
 tick=advanceTeamEffects(tick.state,.3);assert.deepEqual(tick.cues,['break']);
 assert.deepEqual(advanceTeamEffects(tick.state,10).cues,[]);
 const off={...e,id:9,body:{...e.body,x:260}};
 fx=collectTeamEffects(createTeamEffects(),match([off]));
 assert.deepEqual(advanceTeamEffects(fx,1).cues,['ringout']);
});
test('result waits for latest knockout, survivors glide smoothly then stop',()=>{
 const m=match([event(3),event(4),event(5)],{winner:'player',reason:'spin'});
 const fx=collectTeamEffects(createTeamEffects(),m),start=teamBody(fx,0,bodies[0]);
 assert.deepEqual(start,bodies[0]);
 const next=teamBody(advance(fx,.00001),0,bodies[0]);
 assert.ok(Math.abs((next.x-start.x)/.00001-bodies[0].vx)<.01);
 assert.equal(teamFinishDone(advance(fx,1),m),false);
 assert.equal(teamFinishDone(advance(fx,2),m),true);
 const settled=bodies.slice(0,3).map((b,i)=>teamBody(advance(fx,10),i,b));
 assert.ok(settled[1].x-settled[0].x>70);assert.ok(settled[2].x-settled[1].x>70);
 assert.equal(teamBody(advance(fx,4),0,bodies[0]).angle,teamBody(advance(fx,180),0,bodies[0]).angle);
});
test('timeout requires a short beat and spaces all surviving maps',()=>{
 const m=match([],{winner:'draw',reason:'time'}),fx=collectTeamEffects(createTeamEffects(),m);
 assert.equal(teamFinishDone(advance(fx,.2),m),false);
 assert.equal(teamFinishDone(advance(fx,.4),m),true);
 const positions=bodies.map((b,i)=>teamBody(advance(fx,10),i,b));
 assert.ok(Math.abs(positions[3].y-positions[0].y)>60);
});
test('reduced motion hides lost map after short delay and leaves survivors stationary',()=>{
 const m=match([event(2)],{winner:'cpu',reason:'spin'}),fx=collectTeamEffects(createTeamEffects(),m,true);
 assert.equal(teamHidden(advance(fx,.2),2),false);
 assert.equal(teamHidden(advance(fx,.4),2),true);
 assert.deepEqual(teamBody(advance(fx,10),0,bodies[0]),bodies[0]);
 assert.deepEqual(advanceTeamEffects(fx,2).cues,[]);
 assert.equal(teamFinishDone(advance(fx,.4),m),true);
});
test('invalid time cannot corrupt effects and rendering has valid team colors',()=>{
 const fx=collectTeamEffects(createTeamEffects(),match([event(4)]));
 assert.deepEqual(advance(fx,NaN),fx);assert.deepEqual(advance(fx,-1),fx);
 let depth=0;const colors=[];
 const ctx=new Proxy({}, {set(t,k,v){if(k==='fillStyle'||k==='strokeStyle')assert.notEqual(v,undefined);colors.push(v);t[k]=v;return true;},get(t,k){if(k==='createRadialGradient')return ()=>({addColorStop(){}});return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));if(k==='save')depth++;if(k==='restore')depth--;assert.ok(depth>=0);};}});
 drawTeamEffects(ctx,advance(fx,.8),bodies);assert.equal(depth,0);assert.ok(colors.includes('#f6ce80'));
 drawTeamEffects(ctx,advance(fx,10),bodies);assert.equal(depth,0);
});

test('simultaneous overkill winner remains visible without reviving earlier teammates',()=>{
 for(const winner of ['player','cpu'])for(const reduced of [false,true]) {
  const kept=winner==='player'?2:5,other=winner==='player'?5:2;
  const earlier=[event(0),event(1),event(3),event(4)];
  const old=advance(collectTeamEffects(createTeamEffects(),match(earlier),reduced),2);
  const m=match([...earlier,event(2),event(5)],{winner,reason:'spin',tiebreak:'remaining-energy',survivorIndices:[kept]});
  const snapshot=structuredClone(m),fx=collectTeamEffects(old,m,reduced);
  assert.deepEqual(m,snapshot);assert.deepEqual(fx.final.survivors,[kept]);
  assert.equal(fx.effects.some(e=>e.losers.includes(kept)),false);
  const settled=advance(fx,3);
  for(let i=0;i<6;i++)assert.equal(teamHidden(settled,i),i!==kept);
  assert.equal(teamFinishDone(settled,m),true);
  assert.deepEqual(collectTeamEffects(fx,m,reduced),fx);
  assert.equal(teamHidden(settled,other),true);
 }
});
test('actual simultaneous draws still destroy both final pieces',()=>{
 for(const reason of ['spin','ringout']) {
  const m=match(bodies.map((_,i)=>event(i,reason)),{winner:'draw',reason});
  const fx=advance(collectTeamEffects(createTeamEffects(),m),3);
  assert.deepEqual(fx.final.survivors,[]);
  assert.ok(bodies.every((_,i)=>teamHidden(fx,i)));
 }
});

test('engine final slice identifies winning survivors even when effects collect multiple slices',()=>{
 const cities=(pref)=>Array.from({length:3},(_,i)=>({...region,id:`${pref}-${i}`,name:`${i}`,kind:'市',prefectureCode:pref,grit:50,spinPower:50}));
 let m=launch(createTeamMatch(cities('01'),cities('02'),12),{x:0,y:-1},.75);
 // Four earlier defeats must stay hidden; only the last CPU piece wins on overkill.
 m={...m,bodies:m.bodies.map((b,i)=>({...b,energy:i===2||i===5?1:0,rawEnergy:0}))};
 m=step(m,1/120);
 let fx=collectTeamEffects(createTeamEffects(),m);
 m={...m,bodies:m.bodies.map((b,i)=>i===2||i===5?{...b,energy:0,rawEnergy:i===2?-.2:-.1}:b)};
 const final=step(m,.1),snapshot=structuredClone(final);
 fx=collectTeamEffects(fx,final);
 assert.equal(final.result.winner,'cpu');assert.deepEqual(final.result.survivorIndices,[5]);
 assert.equal(final.bodies[5].energy,0);assert.equal(final.bodies[5].rawEnergy,-.1);
 const next=advanceTeamEffects(fx,2);
 assert.equal(next.cues.filter(c=>c==='break').length,5);
 assert.equal(teamHidden(next.state,5),false);
 assert.ok([0,1,2,3,4].every(i=>teamHidden(next.state,i)));
 assert.deepEqual(final,snapshot);
 assert.notEqual(teamBody(advance(fx,.1),5,final.bodies[5]).angle,teamBody(fx,5,final.bodies[5]).angle);
 assert.equal(teamBody(advance(fx,4),5,final.bodies[5]).angle,teamBody(advance(fx,180),5,final.bodies[5]).angle);
});
