const NS='http://www.w3.org/2000/svg';
function node(tag,attributes,text){const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));if(text)el.textContent=text;return el;}
export function drawFrames(svg,frames){
 for(const frame of frames){
  svg.append(node('rect',{x:frame.x,y:frame.y,width:frame.width,height:frame.height,rx:12,class:'map-inset-frame'}));
  svg.append(node('text',{x:frame.x+16,y:frame.y+30,class:'map-inset-title'},frame.label));
 }
}
export function drawSelectionLabels(svg,source,names,bounds,frames=[]){
 const [bx,by,bw,bh]=bounds,placed=[];
 const scale=Math.max(bw/Math.max(svg.clientWidth-32,100),bh/Math.max(svg.clientHeight-16,100));
 const size=11*scale;
 for(const region of source.filter(item=>names.includes(item.name))){
  const points=region.polygons.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const [ax,ay]=region.labelPoint??[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
  const width=(region.name.length+1)*size,height=size*1.7;
  const x=Math.max(bx+width/2,Math.min(bx+bw-width/2,ax));
  const frame=frames.find(item=>item.id===region.frameId);
  const top=frame?frame.y+40+height/2:by+height,bottom=frame?frame.y+frame.height-height/2:by+bh-height;
  let y=Math.max(top,Math.min(bottom,ay-height));
  for(let attempt=0;attempt<10&&placed.some(box=>Math.abs(box.x-x)<(box.width+width)/2&&Math.abs(box.y-y)<height);attempt++)y=Math.min(bottom,y+height*1.2);
  placed.push({x,y,width});
  const label=node('g',{class:'map-selection-label','aria-hidden':'true'});
  label.append(node('line',{x1:ax,y1:ay,x2:x,y2:y,stroke:'#8c6517','stroke-width':1,'vector-effect':'non-scaling-stroke'}));
  label.append(node('circle',{cx:ax,cy:ay,r:size*.22,fill:'#a56a00'}));
  label.append(node('rect',{x:x-width/2,y:y-height/2,width,height,rx:size*.3,fill:'#fff4cf',stroke:'#a77b22','stroke-width':1,'vector-effect':'non-scaling-stroke'}));
  label.append(node('text',{x,y,'font-size':size,'text-anchor':'middle','dominant-baseline':'central',fill:'#3c300d','font-weight':700},region.name));
  svg.append(label);
 }
}
