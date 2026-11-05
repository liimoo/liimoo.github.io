/** Reproducible offline diagnostics, not a claim of balanced city win rates. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createMatch,launch,step,hull} from '../engine.mjs';
const regions=JSON.parse(await readFile(new URL('../regions.json',import.meta.url),'utf8'));
const area=points=>Math.abs(points.reduce((s,p,i)=>s+p[0]*points[(i+1)%points.length][1]-p[1]*points[(i+1)%points.length][0],0))/2;
const features=regions.map((r,index)=>{
 const h=hull(r.points),ha=area(h.map(p=>[p.x,p.y]));
 const perimeter=h.reduce((sum,p,i)=>sum+Math.hypot(p.x-h[(i+1)%h.length].x,p.y-h[(i+1)%h.length].y),0);
 return {index,compactness:4*Math.PI*ha/perimeter**2,concavity:area(r.points)/ha};
});
const ordered=(key,ascending=true)=>[...features].sort((a,b)=>(a[key]-b[key])*(ascending?1:-1));
const chosen=new Set([...ordered('compactness').slice(0,4),...ordered('compactness',false).slice(0,4),...ordered('concavity').slice(0,4)].map(f=>f.index));
for(const name of ['小笠原村','対馬市','奄美市','石垣市','北大東村','新潟市','京都市']){
 const i=regions.findIndex(r=>r.name===name);if(i>=0)chosen.add(i);
}
for(let i=0;i<8;i++)chosen.add((Math.imul(i+11,2654435761)>>>0)%regions.length);
const samples=[...chosen];
const stats=new Map(samples.map(i=>[i,{name:regions[i].name,id:regions[i].id,wins:0,losses:0,draws:0}]));
const durations=[],reasons={},winners={player:0,cpu:0,draw:0};let totalSteps=0;
function run(a,b,seed,mirrored=false,angle=.12){
 let state=launch(createMatch(regions[a],regions[b],seed),{x:Math.sin(angle),y:-Math.cos(angle)},.75);
 // Swap all launch kinematics, rotate the arena 180 degrees. Each shape receives
 // both player and CPU launch conditions; changing seed alone would not remove bias.
 if(mirrored){
  const initial=state.bodies;
  state={...state,bodies:initial.map((body,i)=>({...body,x:-initial[1-i].x,y:-initial[1-i].y,
   vx:-initial[1-i].vx,vy:-initial[1-i].vy,angle:Math.PI,
   spin:initial[1-i].spin,cruiseSpin:initial[1-i].cruiseSpin}))};
 }
 for(let frame=0;frame<5500&&state.phase==='active';frame++){
  state=step(state,1/120);totalSteps++;
  for(const body of state.bodies)for(const key of ['x','y','vx','vy','angle','spin','energy'])
   assert.ok(Number.isFinite(body[key]),`${regions[a].id}/${regions[b].id} invalid ${key}`);
  for(const body of state.bodies){
   assert.ok(body.energy>=0&&body.energy<=1);
   if(body.energy>0)assert.ok(Math.abs(body.spin)>=8&&Math.abs(body.spin)<=24);
  }
 }
 assert.equal(state.phase,'finished');assert.ok(state.elapsed<=45.02);
 durations.push(state.elapsed);winners[state.result.winner]++;reasons[state.result.reason]=(reasons[state.result.reason]||0)+1;
 return state.result.winner;
}
const started=performance.now();
// Every region fights a deterministic counterpart; exercises all geometry in motion.
for(let i=0;i<regions.length;i++)run(i,(i*31+47)%regions.length,i+1);
const fullRosterMs=performance.now()-started;
for(let a=0;a<samples.length;a++)for(let b=a+1;b<samples.length;b++)
for(const seedOffset of [0,1009,7919])for(const angle of [-.35,0,.35])for(const mirrored of [false,true]){
 const ia=samples[a],ib=samples[b],winner=run(ia,ib,101+a*97+b+seedOffset,mirrored,angle);
 for(const [i,side]of [[ia,'player'],[ib,'cpu']]){
  const entry=stats.get(i);entry[winner==='draw'?'draws':winner===side?'wins':'losses']++;
 }
}
durations.sort((a,b)=>a-b);
console.log(JSON.stringify({regions:regions.length,matches:durations.length,steps:totalSteps,
 fullRosterMs,totalMs:performance.now()-started,winners,reasons,
 seconds:{min:durations[0],p10:durations[Math.floor(durations.length*.1)],median:durations[Math.floor(durations.length*.5)],p90:durations[Math.floor(durations.length*.9)],max:durations.at(-1)},
 sample: [...stats.values()].sort((a,b)=>b.wins-a.wins),
 caveat:'Diagnostic sample only, three seeds and three aim angles per pair, each with two mirrored launch states. Full roster has one match per shape, not exhaustive balance proof.'},null,2));
