import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrefectureTeamMatch,launchTeam,step} from '../engine.mjs';
const pref=code=>({id:`pref-${code}`,name:`${code}県`,prefecture:`${code}県`,prefectureCode:code,kind:'県',points:[[-1,-1],[1,-1],[1,1],[-1,1]],grit:50,spinPower:50});
const player=['01','02','03'].map(pref),cpu=['04','05','06'].map(pref);
test('prefecture engine requires exactly three distinct prefectures per side',()=>{
 for(const invalid of [player.slice(0,2),[...player,pref('07')],[player[0],player[0],player[2]],[player[0],{...player[1],prefectureCode:'01'},player[2]],[{...player[0],kind:'市'},...player.slice(1)]]){
  assert.throws(()=>createPrefectureTeamMatch(invalid,cpu));
  assert.throws(()=>createPrefectureTeamMatch(cpu,invalid));
 }
});
test('six prefecture bodies launch independently and finish a finite immutable simulation',()=>{
 const ready=createPrefectureTeamMatch(player,cpu,12),saved=JSON.stringify(ready);
 assert.equal(ready.bodies.length,6);
 assert.deepEqual(ready.bodies.map(b=>b.region.id),[...player,...cpu].map(r=>r.id));
 const settings=[{direction:{x:-1,y:-1},power:.3},{direction:{x:0,y:-1},power:.6},{direction:{x:1,y:-1},power:1}];
 let match=launchTeam(ready,settings);
 assert.equal(JSON.stringify(ready),saved);
 assert.equal(new Set(match.bodies.slice(0,3).map(b=>Math.hypot(b.vx,b.vy).toFixed(5))).size,3);
 for(let i=0;i<600&&match.phase==='active';i++)match=step(match,.1);
 assert.equal(match.phase,'finished');
 assert.ok(match.bodies.every(b=>[b.x,b.y,b.energy,b.angle].every(Number.isFinite)));
 assert.ok(['player','cpu','draw'].includes(match.result.winner));
});
