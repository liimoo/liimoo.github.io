// Web Audio is created only after the player's sound/launch gesture.
export const CUES = Object.freeze(Object.fromEntries(
  ['select','vs','launch','hit','bump','critical','ringout','break','win','lose','draw']
    .map(name=>[name,new URL(`./audio/${name}.mp3${name==='critical'?'?v=20261105-critical-clear':name==='launch'?'?v=20261106-dash':''}`,import.meta.url).href])
));
const MAX_VOICES=4,HIT_COOLDOWN_MS=180,BUMP_COOLDOWN_MS=300,MASTER_GAIN=.22;

export function createBladeAudio(options={}) {
  const contextFactory=options.contextFactory??(()=>new (globalThis.AudioContext??globalThis.webkitAudioContext)());
  const fetchAudio=options.fetch??globalThis.fetch.bind(globalThis);
  const now=options.now??(()=>performance.now());
  const warn=options.warn??((...args)=>console.warn(...args));
  let context,master,loads,enabled=false,generation=0,voices=[],launchVoice=null,lastHit=-Infinity,lastBump=-Infinity;
  const warned=new Set();
  const report=(key,error)=>{
    if(!warned.has(key)){warned.add(key);warn(`都市ブレードの効果音を再生できません (${key})`,error);}
  };
  const load=async(name,url)=>{
    try {
      const response=await fetchAudio(url);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      return await context.decodeAudioData(await response.arrayBuffer());
    }catch(error){report(name,error);return null;}
  };
  const release=source=>{
    voices=voices.filter(item=>item!==source);
    if(launchVoice===source)launchVoice=null;
    source.disconnect();
  };
  const stopSource=source=>{
    try{source.stop();}catch(error){report('stop',error);}
    release(source);
  };
  function stop(){
    generation++;lastHit=-Infinity;lastBump=-Infinity;
    for(const source of [...voices,...(launchVoice?[launchVoice]:[])])stopSource(source);
  }
  function disable(){enabled=false;stop();}
  async function enable(){
    enabled=true;
    const token=generation;
    try{
      if(!context){
        context=contextFactory();master=context.createGain();master.gain.value=MASTER_GAIN;
        master.connect(context.destination);
        loads=Object.fromEntries(Object.entries(CUES).map(([name,url])=>[name,load(name,url)]));
      }
      if(context.state!=='running')await context.resume();
      await Promise.all(Object.values(loads));
      return enabled&&token===generation;
    }catch(error){
      if(token===generation)enabled=false;
      report('enable',error);return false;
    }
  }
  async function play(cue,{decisive=false,enemy=false}={}){
    if(!enabled||!Object.hasOwn(CUES,cue)||!loads)return false;
    const token=generation;
    try{
      const buffer=await loads[cue];
      if(!buffer||!enabled||token!==generation||context.state!=='running')return false;
      const timestamp=now();
      if(cue==='hit'&&!decisive&&timestamp-lastHit<HIT_COOLDOWN_MS)return false;
      if(cue==='bump'&&timestamp-lastBump<BUMP_COOLDOWN_MS)return false;
      // Reserve one launch voice so collision bursts cannot steal its playback.
      if(cue==='launch'){if(launchVoice)stopSource(launchVoice);}
      else if(voices.length>=MAX_VOICES)stopSource(voices[0]);
      const source=context.createBufferSource();source.buffer=buffer;
      if(cue==='critical')source.playbackRate.value=enemy?.65:1.12;
      source.connect(master);source.onended=()=>release(source);
      if(cue==='launch')launchVoice=source;else voices=[...voices,source];
      try{source.start();}catch(error){release(source);throw error;}
      if(cue==='hit')lastHit=timestamp;
      if(cue==='bump')lastBump=timestamp;
      return true;
    }catch(error){report(cue,error);return false;}
  }
  return Object.freeze({enable,disable,stop,play});
}
