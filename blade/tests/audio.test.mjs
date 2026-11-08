import test from 'node:test';
import assert from 'node:assert/strict';
import {createBladeAudio, CUES} from '../audio.mjs';

function fixture(overrides={}) {
  const sources=[],requests=[],warnings=[];let clock=1000;
  const context={state:'suspended',destination:{},resume:async()=>{context.state='running';},
    decodeAudioData:async()=>({}),createGain:()=>({gain:{value:0},connect(){}}),
    createBufferSource:()=>{const s={playbackRate:{value:1},connect(){},start(){s.started=true;},stop(){s.stopped=true;s.onended?.();},disconnect(){}};sources.push(s);return s;}};
  const audio=createBladeAudio({contextFactory:()=>context,fetch:async url=>{requests.push(String(url));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};},now:()=>clock,warn:(...x)=>warnings.push(x),...overrides});
  return {audio,context,sources,requests,warnings,tick:ms=>{clock+=ms;}};
}

test('audio is lazy, preloads twelve module-relative cues once, and resumes on enable',async()=>{
 const f=fixture();assert.equal(await f.audio.play('launch'),false);assert.equal(f.requests.length,0);
 await f.audio.enable();await f.audio.enable();assert.equal(f.requests.length,12);
 assert.equal(Object.keys(CUES).length,12);assert.ok(f.requests.every(x=>new URL(x).pathname.includes('/blade/audio/')&&new URL(x).pathname.endsWith('.mp3')));
 assert.equal(await f.audio.play('select'),true);assert.equal(f.sources.length,1);
});
test('disable stops voices and prevents sound until enabled again',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('launch');f.audio.disable();
 assert.ok(f.sources[0].stopped);assert.equal(await f.audio.play('win'),false);
 await f.audio.enable();assert.equal(await f.audio.play('win'),true);assert.equal(f.requests.length,12);
});
test('stop clears voices but preserves enabled state',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('launch');f.audio.stop();assert.ok(f.sources[0].stopped);
 assert.equal(await f.audio.play('win'),true);
});
test('hit cooldown and four-voice bound suppress audio pileup',async()=>{
 const f=fixture();await f.audio.enable();assert.equal(await f.audio.play('hit'),true);
 assert.equal(await f.audio.play('hit'),false);f.tick(180);assert.equal(await f.audio.play('hit'),true);
 for(let i=0;i<4;i++)await f.audio.play('critical');
 assert.equal(f.sources.filter(s=>!s.stopped).length,4);assert.ok(f.sources[0].stopped);
});
test('missing cues and failed loads do not throw or warn repeatedly',async()=>{
 const f=fixture({fetch:async()=>({ok:false,status:404})});await f.audio.enable();
 assert.equal(f.warnings.length,12);assert.equal(await f.audio.play('launch'),false);
 assert.equal(await f.audio.play('unknown'),false);await f.audio.enable();assert.equal(f.warnings.length,12);
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
 await f.audio.enable();assert.equal(await f.audio.play('launch'),false);assert.equal(f.warnings.length,12);
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

test('critical chime bypasses normal hit cooldown and obeys mute',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('hit');
 assert.equal(await f.audio.play('critical'),true);
 f.audio.disable();assert.equal(await f.audio.play('critical'),false);
});

test('critical asset has an independent cache version',()=>{
 assert.equal(new URL(CUES.critical).searchParams.get('v'),'20261105-critical-clear');
 assert.equal(new URL(CUES.hit).search,'');
});

test('friendly critical keeps its pitch and enemy critical uses a separate unpitched asset',async()=>{
 const f=fixture();await f.audio.enable();
 await f.audio.play('critical');await f.audio.play('critical',{enemy:true});await f.audio.play('hit');
 assert.deepEqual(f.sources.map(s=>s.playbackRate.value),[1.12,1,1]);
 assert.notEqual(f.sources[0].buffer,f.sources[1].buffer);
 assert.ok(new URL(CUES.pain).pathname.endsWith('/pain.mp3'));
 f.audio.disable();assert.equal(await f.audio.play('critical',{enemy:true}),false);
});

test('VS and launch use distinct assets and VS obeys mute',async()=>{
 assert.notEqual(CUES.vs,CUES.launch);
 assert.ok(new URL(CUES.vs).pathname.endsWith('/vs.mp3'));
 const f=fixture();assert.equal(await f.audio.play('vs'),false);
 await f.audio.enable();assert.equal(await f.audio.play('vs'),true);
 f.audio.disable();assert.ok(f.sources[0].stopped);
 assert.equal(await f.audio.play('vs'),false);
});


test('friendly bump has its own 300ms cooldown and cannot bypass it as decisive',async()=>{
 const f=fixture();await f.audio.enable();
 assert.notEqual(CUES.bump,CUES.hit);
 assert.equal(await f.audio.play('bump'),true);
 assert.equal(await f.audio.play('hit'),true,'friendly contact must not suppress enemy damage');
 assert.equal(await f.audio.play('bump',{decisive:true}),false);
 f.tick(299);assert.equal(await f.audio.play('bump'),false);
 f.tick(1);assert.equal(await f.audio.play('bump'),true);
 assert.equal(await f.audio.play('hit'),true);
 f.tick(180);assert.equal(await f.audio.play('hit'),true);
 assert.equal(await f.audio.play('bump'),false,'enemy hit must not reset friendly cooldown');
});

test('friendly bump obeys mute and cooldown resets on stop and re-enable',async()=>{
 const f=fixture();assert.equal(await f.audio.play('bump'),false);
 await f.audio.enable();assert.equal(await f.audio.play('bump'),true);
 f.audio.stop();assert.equal(await f.audio.play('bump'),true);
 f.audio.disable();assert.equal(await f.audio.play('bump',{decisive:true}),false);
 await f.audio.enable();assert.equal(await f.audio.play('bump'),true);
});

 test('launch owns a reserved voice while four effects can be replaced',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('launch');
 const launch=f.sources[0];
 for(let i=0;i<12;i++)await f.audio.play(i%2?'critical':'hit',{decisive:true});
 assert.equal(launch.stopped,undefined);
 assert.equal(f.sources.filter(s=>!s.stopped).length,5);
 f.audio.stop();assert.ok(f.sources.every(s=>s.stopped));
 });
 test('repeated launch replaces only launch and mute stops both channels',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('hit');await f.audio.play('launch');
 await f.audio.play('launch');
 assert.equal(f.sources[0].stopped,undefined);assert.ok(f.sources[1].stopped);
 assert.equal(f.sources[2].stopped,undefined);
 f.audio.disable();assert.ok(f.sources.every(s=>s.stopped));
 });
 test('late ended event from old launch does not release the new launch',async()=>{
 const f=fixture();await f.audio.enable();await f.audio.play('launch');await f.audio.play('launch');
 f.sources[0].onended();f.audio.stop();assert.ok(f.sources[1].stopped);
 });
