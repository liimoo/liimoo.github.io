import {tokyoLayout} from './tokyo-layout.mjs?v=20261106-islands-final';
const INSET_PREFECTURES=new Set(['島根県','長崎県','鹿児島県','沖縄県','32','42','46','47']);
const area=polygon=>Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
function bounds(items){
 const points=items.flatMap(item=>item.polygon);
 let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
 for(const p of points){x=Math.min(x,p[0]);y=Math.min(y,p[1]);right=Math.max(right,p[0]);bottom=Math.max(bottom,p[1]);}
 return {x,y,width:right-x,height:bottom-y};
}
const center=b=>[b.x+b.width/2,b.y+b.height/2];
const distance=(a,b)=>Math.hypot(...center(a).map((v,i)=>v-center(b)[i]));
function connectedGroups(items,gap){
 const parents=items.map((_,i)=>i),boxes=items.map(item=>bounds([item]));
 const root=i=>{while(parents[i]!==i)i=parents[i];return i;};
 for(let i=0;i<items.length;i++)for(let j=0;j<i;j++){
  const a=boxes[i],b=boxes[j];
  const dx=Math.max(a.x-b.x-b.width,b.x-a.x-a.width,0),dy=Math.max(a.y-b.y-b.height,b.y-a.y-a.height,0);
  if(Math.hypot(dx,dy)<=gap)parents[root(i)]=root(j);
 }
 const groups=new Map();
 items.forEach((item,i)=>{const key=root(i);groups.set(key,[...(groups.get(key)||[]),item]);});
 return [...groups.values()].sort((a,b)=>b.reduce((s,p)=>s+p.area,0)-a.reduce((s,p)=>s+p.area,0));
}
function remoteGroups(groups){
 const major=groups.slice(0,8).map(items=>({items,box:bounds(items)}));
 for(const items of groups.slice(8)){
  const box=bounds(items),index=major.reduce((best,g,i)=>distance(box,g.box)<distance(box,major[best].box)?i:best,0);
  major[index]={...major[index],items:[...major[index].items,...items]};
 }
 return major.map(g=>g.items);
}
function fitted(items,box,frameId){
 const b=bounds(items),scale=Math.min(box.width/(b.width||1),box.height/(b.height||1));
 const offset=[box.x+(box.width-b.width*scale)/2,box.y+(box.height-b.height*scale)/2];
 return items.map(item=>({...item,frameId,polygon:item.polygon.map(p=>[offset[0]+(p[0]-b.x)*scale,offset[1]+(p[1]-b.y)*scale])}));
}
function validate(source){
 if(!Array.isArray(source)||!source.every(r=>r&&typeof r.name==='string'&&Array.isArray(r.polygons)&&r.polygons.length&&r.polygons.every(p=>Array.isArray(p)&&p.length>=3&&p.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)))))throw new TypeError('Invalid prefecture selection map');
}
/** Display-only inset layout. Unaffected prefectures return null. */
export function prefectureLayout(source,prefecture,{compact=false}={}){
 const name=String(prefecture);
 if(name==='東京都'||name==='13')return tokyoLayout(source,{compact});
 if(!INSET_PREFECTURES.has(name))return null;
 validate(source);if(!source.length)return null;
 const items=source.flatMap((region,regionIndex)=>region.polygons.map((polygon,polygonIndex)=>({regionIndex,polygonIndex,polygon,area:area(polygon)})));
 const extent=bounds(items),groups=connectedGroups(items,Math.max(extent.width,extent.height)*.025);
 if(groups.length<2)return null;
 const offshore=remoteGroups(groups.slice(1));
 const width=compact?600:1000,mainHeight=compact?370:440,remoteHeight=compact?590:360;
 const frames=[{id:'mainland',label:name==='沖縄県'||name==='47'?'沖縄本島周辺':'本土',x:0,y:0,width,height:mainHeight},
  {id:'islands',label:'離島（位置・縮尺変更）',x:0,y:mainHeight+20,width,height:remoteHeight}];
 const columns=Math.min(compact?2:4,offshore.length),rows=Math.ceil(offshore.length/columns),cellWidth=(width-32)/columns,cellHeight=(remoteHeight-60)/rows;
 const transformed=[...fitted(groups[0],{x:28,y:42,width:width-56,height:mainHeight-70},'mainland'),...offshore.flatMap((group,i)=>
  fitted(group,{x:24+(i%columns)*cellWidth,y:mainHeight+68+Math.floor(i/columns)*cellHeight,width:cellWidth-16,height:cellHeight-16},'islands'))];
 const regions=source.map((region,i)=>{
  const contours=transformed.filter(p=>p.regionIndex===i).sort((a,b)=>a.polygonIndex-b.polygonIndex);
  const primary=contours.reduce((best,p)=>p.area>best.area?p:best);
  return {...region,polygons:contours.map(p=>p.polygon),labelPoint:center(bounds([primary])),frameId:primary.frameId,polygonFrameIds:contours.map(p=>p.frameId)};
 });
 return {regions,frames,bounds:[0,0,width,mainHeight+20+remoteHeight]};
}
