// Physics stays planar; the renderer projects a shallow concave bowl.
export const VIEW_TILT=.78;
const TOP_HEIGHT=10,TOP_RADIUS=32;
const FLOOR_RADIUS=180,BOWL_DEPTH=38;
export function floorOffset({x,y}){
 return BOWL_DEPTH*(1-Math.min((x*x+y*y)/(FLOOR_RADIUS*FLOOR_RADIUS),1));
}
export function projectPoint(point,height=0){return {x:point.x,y:(point.y+floorOffset(point))*VIEW_TILT-height};}
export function screenToWorld({x,y}){
 const target=y/VIEW_TILT;
 // y + floorOffset is strictly increasing (minimum slope 1 - 76/180).
 let low=target-BOWL_DEPTH,high=target;
 for(let i=0;i<48;i++){
  const mid=(low+high)/2;
  if(mid+floorOffset({x,y:mid})<target)low=mid;else high=mid;
 }
 return {x,y:(low+high)/2};
}
function floorPath(ctx,points){
 ctx.beginPath();points.forEach(([x,y],i)=>{
  const down=y+floorOffset({x,y});
  if(i)ctx.lineTo(x,down);else ctx.moveTo(x,down);
 });
}
export function drawBowlFloor(ctx){
 ctx.save();
 // Nested radial contours descend toward the centre. Directional lighting
 // distinguishes the inner back wall from the illuminated near slope.
 for(let radius=FLOOR_RADIUS;radius>0;radius-=3){
  const offset=floorOffset({x:radius,y:0}),slope=radius/FLOOR_RADIUS;
  const shade=ctx.createLinearGradient(0,offset-radius,0,offset+radius);
  shade.addColorStop(0,`hsl(205 55% ${12+5*(1-slope)}%)`);
  shade.addColorStop(.5,`hsl(203 49% ${16+3*(1-slope)}%)`);
  shade.addColorStop(1,`hsl(199 43% ${20+10*slope}%)`);
  ctx.beginPath();ctx.arc(0,offset,radius,0,Math.PI*2);ctx.fillStyle=shade;ctx.fill();
 }
 ctx.strokeStyle='rgba(131,193,214,.11)';ctx.lineWidth=.65;
 for(let axis=-160;axis<=160;axis+=20){
  const extent=Math.sqrt(FLOOR_RADIUS*FLOOR_RADIUS-axis*axis),horizontal=[],vertical=[];
  for(let i=0;i<=72;i++){
   const value=-extent+2*extent*i/72;horizontal.push([value,axis]);vertical.push([axis,value]);
  }
  floorPath(ctx,horizontal);ctx.stroke();floorPath(ctx,vertical);ctx.stroke();
 }
 for(const radius of [60,120,176]){
  ctx.beginPath();ctx.arc(0,floorOffset({x:radius,y:0}),radius,0,Math.PI*2);
  ctx.strokeStyle=radius===176?'rgba(127,190,211,.28)':'rgba(127,190,211,.10)';ctx.lineWidth=1;ctx.stroke();
 }
 // Raised lip: its interior edge surrounds the concave surface.
 ctx.beginPath();ctx.arc(0,0,185,0,Math.PI*2);ctx.strokeStyle='#071c2b';ctx.lineWidth=9;ctx.stroke();
 ctx.beginPath();ctx.arc(0,0,189,0,Math.PI*2);ctx.strokeStyle='#486c80';ctx.lineWidth=3;ctx.stroke();
 ctx.beginPath();ctx.arc(0,0,180,0,Math.PI*2);ctx.strokeStyle='#81a8b7';ctx.lineWidth=1.2;ctx.stroke();
 for(let i=0;i<48;i++){
  const angle=i*Math.PI/24,inner=i%4===0?194:196,outer=i%4===0?201:199;
  ctx.beginPath();ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);ctx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);
  ctx.strokeStyle=i%4===0?'#6f95a5':'#36556a';ctx.lineWidth=1;ctx.stroke();
 }
 ctx.strokeStyle='rgba(133,191,208,.24)';ctx.lineWidth=1;
 floorPath(ctx,[[-8,0],[8,0]]);ctx.stroke();floorPath(ctx,[[0,-8],[0,8]]);ctx.stroke();
 ctx.restore();
}
function polygon(ctx,points){
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
}
export function drawArenaDepth(ctx){
 ctx.save();
 // Front wall shares the same top rim as the arena floor drawn afterwards.
 const wall=ctx.createLinearGradient(0,0,0,207);
 wall.addColorStop(0,'#254c63');wall.addColorStop(.7,'#15384e');wall.addColorStop(1,'#071727');
 ctx.beginPath();ctx.arc(0,14,190,0,Math.PI);ctx.lineTo(-190,0);ctx.arc(0,0,190,Math.PI,0,true);ctx.closePath();
 ctx.fillStyle=wall;ctx.fill();ctx.strokeStyle='#3c6478';ctx.lineWidth=1.4;ctx.stroke();
 ctx.beginPath();ctx.arc(0,14,190,.04,Math.PI-.04);ctx.strokeStyle='#081320';ctx.lineWidth=4;ctx.stroke();
 for(let i=1;i<12;i++){
  const a=i*Math.PI/12,x=Math.cos(a)*189,y=Math.sin(a)*189;
  ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,y+12);ctx.strokeStyle='rgba(123,179,200,.15)';ctx.lineWidth=1;ctx.stroke();
 }
 ctx.restore();
}
function topVertices(body,bounce){
 const c=Math.cos(body.angle),s=Math.sin(body.angle);
 // Small squash/tilt on impact; neither the rotation nor collision shape changes.
 return body.region.points.map(([x,y])=>{
  const rx=(x*c-y*s)*TOP_RADIUS,ry=(x*s+y*c)*TOP_RADIUS;
  return [rx,ry*(1-bounce*.08)+rx*bounce*.04];
 });
}
function drawSides(ctx,points,topY,bottomY,cpu){
 // Edges are extruded in world vertical, rather than rotated with the top face.
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  polygon(ctx,[[a[0],a[1]+topY],[b[0],b[1]+topY],[b[0],b[1]+bottomY],[a[0],a[1]+bottomY]]);
  const light=(a[0]+b[0])/64;
  ctx.fillStyle=cpu?(light<0?'#b08243':'#806034'):(light<0?'#2e8d94':'#205968');ctx.fill();
 }
}
export function drawTop(ctx,body,{color,cpu=false,bounce=0,reduced=false,alpha=1}){
 const impact=reduced?0:Math.min(1,Math.max(0,bounce)),jump=impact*5;
 const points=topVertices(body,impact),topY=-TOP_HEIGHT-jump,bottomY=topY+5;
 ctx.save();ctx.translate(body.x,body.y+floorOffset(body));ctx.globalAlpha=alpha;
 // Contact and soft shadows remain on the floor when the top briefly jumps.
 const shadow=ctx.createRadialGradient(5,6,2,5,6,36+jump);
 shadow.addColorStop(0,'rgba(0,8,17,.46)');shadow.addColorStop(1,'rgba(0,8,17,0)');
 ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(5,6,38+jump,29+jump,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='rgba(0,7,14,.48)';ctx.beginPath();ctx.ellipse(0,2,7,4,0,0,Math.PI*2);ctx.fill();
 // A short metal spindle gives the geographical silhouette a physical pivot.
 polygon(ctx,[[-5,-11-jump],[5,-11-jump],[2,1-jump],[-2,1-jump]]);
 ctx.fillStyle=cpu?'#bba473':'#86b9c5';ctx.fill();
 ctx.strokeStyle='#143d51';ctx.lineWidth=1;ctx.stroke();
 drawSides(ctx,points,topY,bottomY,cpu);
 polygon(ctx,points.map(([x,y])=>[x,y+topY]));
 const face=ctx.createLinearGradient(-25,-40,25,25);
 face.addColorStop(0,cpu?'#fff0c6':'#c4fff8');face.addColorStop(.55,color);face.addColorStop(1,cpu?'#e5b45c':'#4bc3c5');
 ctx.fillStyle=face;ctx.fill();ctx.strokeStyle=cpu?'#fff0bd':'#d1fffb';ctx.lineWidth=1.25;ctx.stroke();
 ctx.beginPath();ctx.ellipse(0,topY,3.6,3.6,0,0,Math.PI*2);ctx.fillStyle='#174154';ctx.fill();
 ctx.beginPath();ctx.ellipse(-.5,topY-.7,1.35,1.35,0,0,Math.PI*2);ctx.fillStyle='#f4ffff';ctx.fill();
 ctx.restore();
}
