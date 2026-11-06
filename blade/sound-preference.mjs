const STORAGE_KEY='city-blade-sound';
// Preference is ON initially; AudioContext creation still waits for a gesture.
export function createSoundPreference({audio,storage,onChange=()=>{}}){
 let enabled=true;
 try{enabled=storage?.getItem(STORAGE_KEY)!=='off';}catch{/* Private browsing may deny storage. */}
 async function activate(){
  if(!enabled)return;
  const ready=await audio.enable();
  if(ready&&enabled)await audio.play('select');
 }
 async function toggle(){
  enabled=!enabled;
  try{storage?.setItem(STORAGE_KEY,enabled?'on':'off');}catch{/* Keep the session preference usable. */}
  onChange(enabled);
  if(enabled)await activate();else audio.disable();
 }
 return Object.freeze({get enabled(){return enabled;},activate,toggle});
}
