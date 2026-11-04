const COLORS=['#71e6df','#f6ce80'];
export function createFinishEffect(match,reduced=false) {
 const {winner,reason}=match.result;
 const losers=reason==='time'?[]:winner==='draw'?[0,1]:[winner==='player'?1:0];
 return {losers,reduced,age:0,duration:(reduced||!losers.length)? .35:1.15,done:false};
}
export function advanceFinishEffect(fx,dt) {
 if(!Number.isFinite(dt)||dt<=0||fx.done)return fx;
 const age=Math.min(fx.duration,fx.age+dt);
 return {...fx,age,done:age>=fx.duration};
}
export function hiddenByFinish(fx,index) {
 return Boolean(fx&&!fx.reduced&&fx.age>=.1&&fx.losers.includes(index));
}
export function finishShake(fx) {
 if(!fx||fx.reduced||!fx.losers.length)return {x:0,y:0};
 const strength=5*Math.max(0,1-Math.max(0,fx.age-.1)/.3);
 return {x:Math.sin(fx.age*137)*strength,y:Math.sin(fx.age*173)*strength*.7};
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
  const body=bodies[index],color=COLORS[index],age=Math.max(0,fx.age-.1);
  ctx.save();ctx.translate(body.x,body.y);
  if(fx.reduced) {
   ctx.globalAlpha=.35*(1-fx.age/fx.duration);ring(ctx,42,color,3);ctx.restore();continue;
  }
  if(fx.age<.1) {
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
