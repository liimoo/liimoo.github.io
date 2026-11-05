import test from 'node:test';
import assert from 'node:assert/strict';
import {createBladeAudio, CUES} from '../audio.mjs';

function fixture(overrides={}) {
  const sources=[],requests=[],warnings=[];let clock=1000;
  const context={state:'suspended',destination:{},resume:async()=>{context.state='running';},
    decodeAudioData:async()=>({}),createGain:()=>({gain:{value:0},connect(){}}),
    createBufferSource:()=>{const s={connect(){},start(){s.started=true;},stop(){s.stopped=true;s.onended?.();},disconnect(){}};sources.push(s);return s;}};
  const audio=createBladeAudio({contextFactory:()=>context,fetch:async url=>{requests.push(String(url));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};},now:()=>clock,warn:(...x)=>warnings.push(x),...overrides});
  return {audio,context,sources,requests,warnings,tick:ms=>{clock+=ms;}};
}

test('audio is lazy, preloads eight module-relative cues once, and resumes on enable',async()=>{
 const f=fixture();assert.equal(await f.audio.play('launch'),false);assert.equal(f.requests.length,0);
 await f.audio.enable();await f.audio.enable();assert.equal(f.requests.length,8);
 assert.equal(Object.keys(CUES).length,8);assert.ok(f.requests.every(x=>x.includes('/blade/audio/')&&x.endsWith('.mp3')));
 assert.equal(await f.audio.play('select'),true);assert.equal(f.sources.length,1);
});
test('disable stops voices and prevents sound until enabled again',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('launch');f.audio.disable();
 assert.ok(f.sources[0].stopped);assert.equal(await f.audio.play('win'),false);
 await f.audio.enable();assert.equal(await f.audio.play('win'),true);assert.equal(f.requests.length,8);
});
test('stop clears voices but preserves enabled state',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('launch');f.audio.stop();assert.ok(f.sources[0].stopped);
 assert.equal(await f.audio.play('win'),true);
});
test('hit cooldown and four-voice bound suppress audio pileup',async()=>{
 const f=fixture();await f.audio.enable();assert.equal(await f.audio.play('hit'),true);
 assert.equal(await f.audio.play('hit'),false);f.tick(180);assert.equal(await f.audio.play('hit'),true);
 for(let i=0;i<4;i++)await f.audio.play('launch');
 assert.equal(f.sources.filter(s=>!s.stopped).length,4);assert.ok(f.sources[0].stopped);
});
test('missing cues and failed loads do not throw or warn repeatedly',async()=>{
 const f=fixture({fetch:async()=>({ok:false,status:404})});await f.audio.enable();
 assert.equal(f.warnings.length,8);assert.equal(await f.audio.play('launch'),false);
 assert.equal(await f.audio.play('unknown'),false);await f.audio.enable();assert.equal(f.warnings.length,8);
});
test('pending sounds never play after stop or disable, even after re-enable',async()=>{
 for(const method of ['stop','disable']){
  let finish;const gate=new Promise(r=>{finish=r;});
  const f=fixture({fetch:async()=>{await gate;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
  const enabling=f.audio.enable();const playing=f.audio.play('launch');f.audio[method]();
  const again=f.audio.enable();finish();await Promise.all([enabling,again]);
  assert.equal(await playing,false);assert.equal(f.sources.length,0);
  assert.equal(await f.audio.play('win'),true);
 }
});
test('unsupported audio and resume failures are safe',async()=>{
 const f=fixture({contextFactory:()=>{throw new Error('unsupported');}});
 assert.equal(await f.audio.enable(),false);assert.equal(await f.audio.play('launch'),false);
 const g=fixture();g.context.resume=async()=>{throw new Error('blocked');};
 assert.equal(await g.audio.enable(),false);assert.equal(await g.audio.play('launch'),false);
});
test('decode and source start failures stay isolated from gameplay',async()=>{
 const f=fixture();f.context.decodeAudioData=async()=>{throw new Error('invalid audio');};
 await f.audio.enable();assert.equal(await f.audio.play('launch'),false);assert.equal(f.warnings.length,8);
 const g=fixture();await g.audio.enable();
 g.context.createBufferSource=()=>({connect(){},disconnect(){},start(){throw new Error('device lost');}});
 assert.equal(await g.audio.play('launch'),false);assert.equal(g.warnings.length,1);
});
test('finished voices are released and disabled in-flight enable returns false',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('launch');f.sources[0].onended();
 f.audio.stop();assert.equal(f.sources[0].stopped,undefined);
 let resume;const g=fixture();g.context.resume=()=>new Promise(r=>{resume=r;});
 const pending=g.audio.enable();g.audio.disable();resume();assert.equal(await pending,false);
});
test('decisive hit bypasses cooldown but still respects mute',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('hit');
 assert.equal(await f.audio.play('hit',{decisive:true}),true);
 assert.equal(await f.audio.play('hit'),false);
 f.audio.disable();assert.equal(await f.audio.play('hit',{decisive:true}),false);
});
