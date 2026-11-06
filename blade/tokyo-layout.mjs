// Selection-only presentation: gameplay geography always uses the original data.
const IZU_NAMES=['大島町','利島村','新島村','神津島村','三宅村','御蔵島村','八丈町','青ヶ島村'];
function extent(polygons){
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const polygon of polygons)for(const [x,y] of polygon){
  minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
 }
 return {minX,minY,width:maxX-minX,height:maxY-minY};
}
function fit(polygons,box){
 const b=extent(polygons),scale=Math.min(box.width/(b.width||1),box.height/(b.height||1));
 const x=box.x+(box.width-b.width*scale)/2,y=box.y+(box.height-b.height*scale)/2;
 return polygons.map(polygon=>polygon.map(([px,py])=>[x+(px-b.minX)*scale,y+(py-b.minY)*scale]));
}
function center(polygons){
 const b=extent(polygons);return [b.minX+b.width/2,b.minY+b.height/2];
}
function cell(frame,index,count,columns){
 const rows=Math.ceil(count/columns),width=(frame.width-32)/columns,height=(frame.height-64)/rows;
 return {x:frame.x+16+(index%columns)*width,y:frame.y+40+Math.floor(index/columns)*height,width,height};
}
function polygonBox(box){return {x:box.x+12,y:box.y+8,width:box.width-24,height:box.height-36};}
const area=p=>Math.abs(p.reduce((sum,v,i)=>{const q=p[(i+1)%p.length];return sum+v[0]*q[1]-q[0]*v[1];},0))/2;
function contourAnchor(original,fitted){
 const index=original.reduce((best,p,i)=>area(p)>area(original[best])?i:best,0);
 return center([fitted[index]]);
}
function islandGroups(polygons){
 const ranked=polygons.map((polygon,index)=>({polygon,index,area:area(polygon)})).sort((a,b)=>b.area-a.area);
 const pointDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 let seeds=ranked.slice(0,4);
 while(seeds.length<Math.min(8,ranked.length)){
  const remaining=ranked.filter(item=>!seeds.includes(item));
  const nearest=item=>Math.min(...seeds.map(seed=>pointDistance(center([item.polygon]),center([seed.polygon]))));
  const next=remaining.reduce((best,item)=>nearest(item)>nearest(best)?item:best);
  seeds=[...seeds,next];
 }
 const groups=seeds.map(item=>({anchor:center([item.polygon]),items:[item]}));
 for(const item of ranked.filter(item=>!seeds.includes(item))){
  const point=center([item.polygon]);
  const distance=group=>Math.hypot(point[0]-group.anchor[0],point[1]-group.anchor[1]);
  const index=groups.reduce((best,group,i)=>distance(group)<distance(groups[best])?i:best,0);
  groups[index]={...groups[index],items:[...groups[index].items,item]};
 }
 return groups.map(group=>group.items);
}
function validate(source){
 if(!Array.isArray(source)||!source.every(r=>r&&typeof r.name==='string'&&Array.isArray(r.polygons)&&r.polygons.length&&r.polygons.every(p=>Array.isArray(p)&&p.length>=3&&p.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))))){
  throw new TypeError('Invalid Tokyo selection map');
 }
}
/** Returns fresh display polygons, named frames, label anchors, and SVG viewBox bounds. */
export function tokyoLayout(source,{compact=false}={}){
 validate(source);
 const frames=compact?[
  {id:'mainland',label:'本土',x:0,y:0,width:600,height:300},
  {id:'izu',label:'伊豆諸島',x:0,y:320,width:600,height:380},
  {id:'ogasawara',label:'小笠原諸島',x:0,y:720,width:600,height:240},
 ]:[
  {id:'mainland',label:'本土',x:0,y:0,width:1000,height:440},
  {id:'izu',label:'伊豆諸島',x:0,y:460,width:490,height:340},
  {id:'ogasawara',label:'小笠原諸島',x:510,y:460,width:490,height:340},
 ];
 const mainland=source.filter(r=>!IZU_NAMES.includes(r.name)&&r.name!=='小笠原村');
 const allMainland=mainland.flatMap(r=>r.polygons);
 const fittedMainland=allMainland.length?fit(allMainland,{x:frames[0].x+28,y:frames[0].y+42,width:frames[0].width-56,height:frames[0].height-70}):[];
 const mainlandPolygons=new Map();let offset=0;
 for(const r of mainland){mainlandPolygons.set(r.name,fittedMainland.slice(offset,offset+r.polygons.length));offset+=r.polygons.length;}
 const regions=source.map(region=>{
  const izuIndex=IZU_NAMES.indexOf(region.name);
  if(izuIndex>=0){
   const box=cell(frames[1],izuIndex,8,4),polygons=fit(region.polygons,polygonBox(box));
   return {...region,polygons,frameId:'izu',labelPoint:contourAnchor(region.polygons,polygons),namePoint:[box.x+box.width/2,box.y+box.height-10]};
  }
  if(region.name==='小笠原村'){
   // Satellites stay near a principal island instead of creating tiny individual cells.
   const groups=islandGroups(region.polygons);
   const packed=groups.flatMap((group,i)=>{
    const fitted=fit(group.map(item=>item.polygon),polygonBox(cell(frames[2],i,groups.length,4)));
    return group.map((item,j)=>({index:item.index,polygon:fitted[j]}));
   });
   const polygons=packed.sort((a,b)=>a.index-b.index).map(item=>item.polygon);
   return {...region,polygons,frameId:'ogasawara',labelPoint:contourAnchor(region.polygons,polygons),namePoint:[frames[2].x+frames[2].width/2,frames[2].y+frames[2].height-16]};
  }
  const polygons=mainlandPolygons.get(region.name);
  return {...region,polygons,frameId:'mainland',labelPoint:center(polygons)};
 });
 return {regions,frames,bounds:compact?[0,0,600,960]:[0,0,1000,800]};
}
