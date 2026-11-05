import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseCity,defaultTeam,validTeam} from '../team-roster.mjs';
const regions=[{id:'pref',name:'A県',prefecture:'A県',prefectureCode:'01'},...Array.from({length:5},(_,i)=>({id:`a${i}`,name:`A${i}市`,prefecture:'A県',prefectureCode:'01'})),...Array.from({length:3},(_,i)=>({id:`b${i}`,name:`B${i}市`,prefecture:'B県',prefectureCode:'02'}))];
test('team selection toggles unique cities, caps three and clears on new prefecture',()=>{
 const initial=[1,2];assert.deepEqual(chooseCity(regions,initial,3),[1,2,3]);assert.deepEqual(initial,[1,2]);
 assert.deepEqual(chooseCity(regions,[1,2,3],4),[1,2,3]);assert.deepEqual(chooseCity(regions,[1,2,3],2),[1,3]);
 assert.deepEqual(chooseCity(regions,[1,2,3],6),[6]);assert.deepEqual(chooseCity(regions,[1],0),[1]);
 assert.deepEqual(chooseCity(regions,[1],999),[1]);
});
test('default team uses the reference prefecture and validation rejects mixed/duplicate/prefecture picks',()=>{
 assert.deepEqual(defaultTeam(regions,2),[2,1,3]);assert.equal(validTeam(regions,[1,2,3]),true);
 for(const roster of [[1,2],[1,1,2],[1,2,6],[0,1,2],[1,2,999]])assert.equal(validTeam(regions,roster),false);
});
