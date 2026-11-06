import test from 'node:test';
import assert from 'node:assert/strict';
import {newSelection,randomOpponent} from '../selection-state.mjs';
const regions=['01','02'].flatMap(prefectureCode=>[{name:prefectureCode,prefecture:prefectureCode,prefectureCode,kind:'県'},...[0,1,2,3].map(i=>({name:`${prefectureCode}-${i}`,prefecture:prefectureCode,prefectureCode,kind:'市'}))]);
test('new solo selection is blank and CPU changes with supplied randomness',()=>{
 const a=newSelection(regions,'single',()=>0),b=newSelection(regions,'single',()=>.99);
 assert.equal(a.selected,null);assert.deepEqual(a.playerTeam,[]);assert.notEqual(a.opponent,b.opponent);
 assert.equal(randomOpponent(regions,0,()=>0),1);
});
test('new team selection is empty and random CPU has three distinct cities in one prefecture',()=>{
 for(const value of [0,.3,.99]){
  const s=newSelection(regions,'team',()=>value);
  assert.equal(s.selected,null);assert.deepEqual(s.playerTeam,[]);assert.equal(s.cpuTeam.length,3);
  assert.equal(new Set(s.cpuTeam).size,3);assert.equal(new Set(s.cpuTeam.map(i=>regions[i].prefectureCode)).size,1);
  assert.ok(s.cpuTeam.every(i=>regions[i].kind==='市'));assert.equal(s.opponent,s.cpuTeam[0]);
 }
});
