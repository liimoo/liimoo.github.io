const pick=(items,random)=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
export function randomOpponent(regions,excluded=null,random=Math.random){
 return pick(regions.map((_,i)=>i).filter(i=>i!==excluded),random)??null;
}
export function newSelection(regions,mode,random=Math.random){
 if(mode!=='team')return {selected:null,opponent:randomOpponent(regions,null,random),playerTeam:[],cpuTeam:[]};
 const counties=new Map();
 regions.forEach((r,i)=>{if(r.name===r.prefecture)return;const code=r.prefectureCode??r.prefecture;counties.set(code,[...(counties.get(code)??[]),i]);});
 const available=pick([...counties.values()].filter(items=>items.length>=3),random)??[];
 const cpuTeam=Array.from({length:3}).reduce(chosen=>{
  const index=pick(available.filter(i=>!chosen.includes(i)),random);
  return index===undefined?chosen:[...chosen,index];
 },[]);
 return {selected:null,opponent:cpuTeam[0]??null,playerTeam:[],cpuTeam};
}
