const COLORS=['#71e6df','#f6ce80'];
export function createFinishEffect(match,reduced=false,previousBodies=match.bodies) {
 const {winner,reason}=match.result;
 const losers=reason==='time'?[]:winner==='draw'?[0,1]:[winner==='player'?1:0];
 const burstAt=reason==='ringout'?.4:.65;
 const origins=match.bodies.map((body,i)=>({...body,spin:(losers.includes(i)||body.energy<=0?previousBodies[i].spin:body.spin)??body.cruiseSpin??0}));
 const fx={losers,origins,reason,burstAt,reduced,age:0,motionAge:0,
  duration:(reduced||!losers.length)?.35:burstAt+1.05,done:false};
 return !reduced&&reason==='ringout'&&!losers.some(i=>canExplode(fx,i))?{...fx,duration:.55}:fx;
}
export function advanceFinishEffect(fx,dt) {
 if(!Number.isFinite(dt)||dt<=0)return fx;
 const age=Math.min(fx.duration,fx.age+dt);
 return {...fx,age,motionAge:fx.motionAge+dt,done:age>=fx.duration};
}
export function finishBody(fx,index,body) {
 if(!fx||fx.reduced)return body;
 if(!fx.losers.includes(index)) {
  const origin=fx.origins[index],t=fx.motionAge,decay=Math.exp(-2*t);
  const targetX=fx.losers.length?0:(index?55:-55),targetY=65;
  const glide=(position,velocity,target)=>target+(position-target+((velocity??0)+2*(position-target))*t)*decay;
  // Ease rotation to a complete stop in four seconds, preserving initial spin.
  const stopTime=4,spinTime=Math.min(t,stopTime);
  return {...body,x:glide(origin.x,origin.vx,targetX),y:glide(origin.y,origin.vy,targetY),
   angle:origin.angle+origin.spin*(spinTime-spinTime*spinTime/stopTime+spinTime**3/(3*stopTime**2))};
 }
 const origin=fx.origins[index];
 if(fx.reason==='ringout') {
  const t=Math.min(fx.age,fx.burstAt),distance=Math.hypot(origin.x,origin.y)||1;
  return {...body,x:origin.x+(origin.x/distance*115+(origin.vx??0)*.2)*t,
   y:origin.y+(origin.y/distance*115+(origin.vy??0)*.2)*t,
   angle:origin.angle+origin.spin*t};
 }
 const t=Math.min(fx.age,.45),duration=.45;
 // Integrate spin * (1-t/duration)^2, then hold completely still before bursting.
 return {...body,angle:origin.angle+origin.spin*(t-t*t/duration+t*t*t/(3*duration*duration))};
}
export function canExplode(fx,index) {
 if(!fx||fx.reduced||!fx.losers.includes(index))return false;
 const body=finishBody({...fx,age:fx.burstAt},index,fx.origins[index]);
 const c=Math.cos(body.angle),s=Math.sin(body.angle);
 let points=body.region.points.map(([x,y])=>({x:body.x+32*(x*c-y*s),y:body.y+32*(x*s+y*c)}));
 // Clip the displayed outline against the canvas, not just a circular bounding radius.
 for(const [axis,edge,sign] of [['x',-220,1],['x',220,-1],['y',-220,1],['y',220,-1]]) {
  const clipped=[];
  for(let i=0;i<points.length;i++) {
   const a=points[i],b=points[(i+1)%points.length];
   const insideA=(a[axis]-edge)*sign>=0,insideB=(b[axis]-edge)*sign>=0;
   if(insideA)clipped.push(a);
   if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
  }
  points=clipped;
 }
 return points.length>=3;
}
export function hiddenByFinish(fx,index) {
 return Boolean(fx&&!fx.reduced&&fx.age>=fx.burstAt&&fx.losers.includes(index));
}
export function finishShake(fx) {
 if(!fx||fx.reduced||fx.age<fx.burstAt||!fx.losers.some(i=>canExplode(fx,i)))return {x:0,y:0};
 const age=fx.age-fx.burstAt,strength=5*Math.max(0,1-age/.3);
 return {x:Math.sin(age*137)*strength,y:Math.sin(age*173)*strength*.7};
}
function polygon(ctx,points) {
 ctx.beginPath();points.forEach((p,i)=>{const x=p[0]*32,y=p[1]*32;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
}
function ring(ctx,radius,color,width) {
 ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function fragment(ctx,body,index,age,color) {
 const start=index*Math.PI/6,end=(index+1)*Math.PI/6,mid=(start+end)/2;
 const distance=(55+(index*37%65))*age;
 const direction=mid+body.angle;
 ctx.save();ctx.translate(Math.cos(direction)*distance,Math.sin(direction)*distance+60*age*age);
 ctx.rotate(body.angle);ctx.translate(Math.cos(mid)*15,Math.sin(mid)*15);
 ctx.rotate(((index%2)?1:-1)*age*(1+index%3));ctx.translate(-Math.cos(mid)*15,-Math.sin(mid)*15);
 // Sector clipping preserves the actual map silhouette, including concavities.
 ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(start)*60,Math.sin(start)*60);
 ctx.lineTo(Math.cos(end)*60,Math.sin(end)*60);ctx.closePath();ctx.clip();
 polygon(ctx,body.region.points);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff4d6';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
}
export function drawFinishEffect(ctx,fx,bodies) {
 if(!fx)return;
 for(const index of fx.losers) {
  if(!fx.reduced&&(fx.age<fx.burstAt||!canExplode(fx,index)))continue;
  const body=finishBody({...fx,age:fx.burstAt},index,bodies[index]),color=COLORS[index],age=Math.max(0,fx.age-fx.burstAt);
  ctx.save();ctx.translate(body.x,body.y);
  if(fx.reduced) {
   ctx.globalAlpha=.35*(1-fx.age/fx.duration);ring(ctx,42,color,3);ctx.restore();continue;
  }
  if(age<.07) {
   ctx.rotate(body.angle);polygon(ctx,body.region.points);ctx.fillStyle='#fff4d6';ctx.fill();
  } else {
   ctx.globalAlpha=Math.max(0,1-age/1.05);
   for(let k=0;k<12;k++)fragment(ctx,body,k,age,color);
   ctx.globalAlpha=Math.max(0,1-age/.65);
   ring(ctx,22+age*160,'#fff1b5',Math.max(.1,4*(1-age/.8)));ring(ctx,12+age*110,color,2);
   const glow=ctx.createRadialGradient(0,0,0,0,0,70);
   glow.addColorStop(0,'#fff7ccaa');glow.addColorStop(1,'#ffd78300');ctx.fillStyle=glow;ctx.fillRect(-70,-70,140,140);
   for(let k=0;k<28;k++) {
    const a=k*2.39996,r=14+age*(90+(k*47%150));
    ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
    ctx.lineTo(Math.cos(a)*(r+8),Math.sin(a)*(r+8));ctx.strokeStyle=k%3?color:'#ffffff';ctx.lineWidth=k%2?2:3;ctx.stroke();
   }
  }
  ctx.restore();
 }
}
