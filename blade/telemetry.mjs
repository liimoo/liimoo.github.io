// Anonymous match statistics. No browser/user identifier or persistent storage.
export const TELEMETRY_ENDPOINT='https://djgafiowdldqtearqtdd.supabase.co/functions/v1/blade-telemetry';
const DISABLED_MATCH=Object.freeze({finish:()=>Promise.resolve(false)});
export function createBladeTelemetry(options={}){
 const fetcher=options.fetch??globalThis.fetch.bind(globalThis);
 const uuid=options.uuid??(()=>globalThis.crypto.randomUUID());
 const timeoutMs=options.timeoutMs??4000;
 async function send(payload){
  for(let attempt=0;attempt<2;attempt++){
   const controller=new AbortController();let timer;
   try{
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Telemetry timeout'));},timeoutMs);});
    const response=await Promise.race([fetcher(TELEMETRY_ENDPOINT,{
     method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',
     body:JSON.stringify(payload),keepalive:true,signal:controller.signal,
    }),timeout]);
    if(response.ok)return true;
    if(response.status<500)return false;
   }catch{/* Optional statistics must never interrupt gameplay. Retry only once. */}
   finally{clearTimeout(timer);}
  }
  return false;
 }
 function start({mode,player_regions,cpu_regions}){
  let matchId;try{matchId=uuid();}catch{return DISABLED_MATCH;}
  const started=send({event:'start',match_id:matchId,mode,player_regions:[...player_regions],cpu_regions:[...cpu_regions]});
  let completion;
  return Object.freeze({finish({winner,reason,duration}){
   if(!completion)completion=started.then(accepted=>accepted?send({event:'finish',match_id:matchId,winner,reason,duration}):false);
   return completion;
  }});
 }
 return Object.freeze({start});
}
