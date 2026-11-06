import test from 'node:test';
import assert from 'node:assert/strict';
import {choosePrefecture, validPrefectureTeam} from '../team-roster.mjs';
import {newSelection} from '../selection-state.mjs';
const regions=['01','02','03','04'].flatMap(prefectureCode=>[
 {kind:'県',name:`${prefectureCode}県`,prefecture:`${prefectureCode}県`,prefectureCode},
 ...[0,1,2].map(i=>({kind:'市',name:`${prefectureCode}-${i}市`,prefecture:`${prefectureCode}県`,prefectureCode})),
]);
test('prefecture roster toggles three distinct prefectures without mutating input',()=>{
 const initial=Object.freeze([0,4]);
 assert.deepEqual(choosePrefecture(regions,initial,8),[0,4,8]);
 assert.deepEqual(initial,[0,4]);
 assert.deepEqual(choosePrefecture(regions,[0,4,8],12),[0,4,8]);
 assert.deepEqual(choosePrefecture(regions,[0,4,8],4),[0,8]);
 for(const invalid of [1,-1,999])assert.deepEqual(choosePrefecture(regions,[0],invalid),[0]);
});
test('prefecture validation requires exactly three unique prefectures and rejects cities',()=>{
 assert.equal(validPrefectureTeam(regions,[0,4,8]),true);
 for(const roster of [[],[0,4],[0,4,8,12],[0,0,4],[0,4,5],[0,4,999],null]){
  assert.equal(validPrefectureTeam(regions,roster),false);
 }
 const duplicated=[...regions,{...regions[0]}];
 assert.equal(validPrefectureTeam(duplicated,[0,4,16]),false);
 assert.deepEqual(choosePrefecture(duplicated,[0,4],16),[0,4]);
});
test('prefecture mode begins with blank player and randomized unique prefecture CPU roster',()=>{
 const rosters=[];
 for(const value of [0,.3,.99]){
  const result=newSelection(regions,'pref-team',()=>value);
  assert.equal(result.selected,null);
  assert.deepEqual(result.playerTeam,[]);
  assert.equal(result.opponent,result.cpuTeam[0]);
  assert.equal(validPrefectureTeam(regions,result.cpuTeam),true);
  rosters.push(result.cpuTeam);
 }
 assert.notDeepEqual(rosters[0],rosters[2]);
});
test('existing solo and city team modes keep their selection rules',()=>{
 const solo=newSelection(regions,'single',()=>0);
 assert.equal(solo.selected,null);assert.deepEqual(solo.cpuTeam,[]);
 const cities=newSelection(regions,'team',()=>0);
 assert.equal(cities.cpuTeam.length,3);
 assert.ok(cities.cpuTeam.every(i=>regions[i].name!==regions[i].prefecture));
 assert.equal(new Set(cities.cpuTeam.map(i=>regions[i].prefectureCode)).size,1);
});
