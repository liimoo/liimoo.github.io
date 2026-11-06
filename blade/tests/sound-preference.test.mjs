import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundPreference} from '../sound-preference.mjs';
function fixture(value){
 const calls=[];let saved=value;
 const audio={enable:async()=>{calls.push('enable');return true;},disable:()=>calls.push('disable'),play:cue=>calls.push(cue)};
 const storage={getItem:()=>saved,setItem:(key,value)=>{saved=value;}};
 const preference=createSoundPreference({audio,storage});
 return {preference,calls,saved:()=>saved};
}
test('first visit defaults on without loading or playing audio',()=>{const f=fixture(null);assert.equal(f.preference.enabled,true);assert.deepEqual(f.calls,[]);});
test('mode gesture enables audio and plays selection cue',async()=>{const f=fixture(null);await f.preference.activate();assert.deepEqual(f.calls,['enable','select']);});
test('saved OFF stays silent on mode gesture and persists toggles',async()=>{const f=fixture('off');await f.preference.activate();assert.deepEqual(f.calls,[]);await f.preference.toggle();assert.equal(f.saved(),'on');await f.preference.toggle();assert.equal(f.saved(),'off');assert.equal(f.calls.at(-1),'disable');});
test('storage failures do not prevent controls',async()=>{const f=createSoundPreference({audio:{disable(){},enable:async()=>true,play(){}},storage:{getItem(){throw Error();},setItem(){throw Error();}}});assert.equal(f.enabled,true);await f.toggle();assert.equal(f.enabled,false);});
test('OFF cancels a pending activation cue',async()=>{let done;const calls=[];const f=createSoundPreference({audio:{enable:()=>new Promise(resolve=>done=resolve),disable:()=>calls.push('disable'),play:()=>calls.push('play')},storage:null});const pending=f.activate();await f.toggle();done(true);await pending;assert.deepEqual(calls,['disable']);});
