import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,createTeamMatch,launchTeam,launch,step} from '../engine.mjs';
const shapes=[{points:[[-.7,-.7],[.7,-.7],[.7,.7],[-.7,.7]]},{points:[[-1,-.25],[1,-.25],[1,.25],[-1,.25]]}];
test('sideways solo launches meet within four seconds across shapes and seeds',()=>{
 for(const a of shapes)for(const b of shapes)for(const seed of [1,12,12345])for(const angle of [-90,-65,45,65,90])for(const power of [.2,.75,1]){
  let m=launch(createMatch(a,b,seed),{x:Math.sin(angle*Math.PI/180),y:-Math.cos(angle*Math.PI/180)},power);
  while(m.phase==='active'&&!m.impactSerial&&m.elapsed<4)m=step(m,1/60);
  assert.ok(m.impactSerial>0,`angle=${angle} power=${power} seed=${seed} elapsed=${m.elapsed}`);
 }
});
test('opening assistance does not change the initial launch or post-contact movement',()=>{
 const m=launch(createMatch(...shapes,12),{x:1,y:0},1);
 assert.deepEqual(step(m,.1).bodies,step({...m,impactSerial:1},.1).bodies);
 const later={...m,elapsed:2,impactSerial:1};
 assert.deepEqual(step(later,.1).bodies,step({...later,elapsed:3},.1).bodies);
});

test('team movement is independent of opening elapsed time',()=>{
 const team=shapes.concat(shapes[0]).map((r,i)=>({...r,id:String(i),kind:'市',prefectureCode:'01'}));
 const m=launchTeam(createTeamMatch(team,team,12),team.map(()=>({direction:{x:1,y:0},power:.75})));
 assert.deepEqual(step({...m,elapsed:0},.1).bodies,step({...m,elapsed:3},.1).bodies);
});
