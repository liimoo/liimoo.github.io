/** UI descriptions only: never alter critical probability or combat damage. */
export function criticalPresentations(hit,bodies){
 const participants=hit.participants??(bodies.length===2?[0,1]:[]);
 return [...new Set(hit.criticalAttackers??[])].flatMap(attacker=>{
  const defender=participants.find(index=>index!==attacker);
  const source=bodies[attacker],target=bodies[defender];
  if(!participants.includes(attacker)||!source||!target||source.side===target.side)return [];
  const enemy=source.side==='cpu';
  return [{attacker,defender,enemy,label:enemy?'痛恨の一撃！':'会心の一撃！',
   city:source.region.name,color:enemy?'#ff8768':'#91fff0'}];
 });
}
