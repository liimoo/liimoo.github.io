import {createFinishEffect,advanceFinishEffect,hiddenByFinish,finishShake,drawFinishEffect} from './finish-effects.mjs';
import {createMatch,launch,step,ARENA_RADIUS,BODY_RADIUS,MATCH_SECONDS} from './engine.mjs';
const $=id=>document.getElementById(id);
const canvas=$('arena'),ctx=canvas.getContext('2d');
let regions=[],selected=0,opponent=1,match=null,aim=null,seed=1,paused=false,last=0,accumulator=0,sound=false,audio=null,lastHit=-1,finishEffect=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors=['#71e6df','#f6ce80'];
function tone(freq=400,length=.08){
 if(!sound)return;
 try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+length);g.gain.setValueAtTime(.07,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length);}catch{sound=false;$('sound').textContent='音 OFF';$('sound').setAttribute('aria-pressed','false');}
}
function track(name,params={}){if(typeof window.gtag==='function')window.gtag('event',name,{...params,page_path:location.pathname});}
function reset(){
 match=createMatch(regions[selected],regions[opponent],seed++);finishEffect=null;aim=null;paused=false;accumulator=0;lastHit=-1;
 $('result').hidden=true;$('pause-cover').hidden=true;$('pause').disabled=true;$('pause').textContent='Ⅱ';
 $('player-name').textContent=regions[selected].name;$('cpu-name').textContent=regions[opponent].name;$('opponent-name').textContent=regions[opponent].name;
 $('region-kind').textContent=regions[selected].kind==='市'?`${regions[selected].prefecture} / 市のかたち`:'都道府県のかたち';
 $('region-hint').textContent=regions[selected].hint;$('region-link').href=regions[selected].url;
 $('status').textContent='地域を選んだら、青い地図を引いて発射。';$('arena-caption').textContent='青い地図を手前に引いて、はなそう';$('share-status').textContent='';
 document.querySelectorAll('.region-card').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));controls(false);updateHud();draw(0);
}
function controls(active){for(const el of document.querySelectorAll('.region-card,#shuffle,#launch,#angle,#power'))el.disabled=active;}
function fire(direction,power){if(!match||match.phase!=='ready')return;match=launch(match,direction,power);aim=null;controls(true);$('pause').disabled=false;$('status').textContent='相手を場外へ！ 発射後は自動で進みます。';$('arena-caption').textContent='青があなた ／ 金がCPU';tone(660,.16);track('blade_start',{region:regions[selected].id,opponent:regions[opponent].id});}
function fireFromControls(){const a=Number($('angle').value)*Math.PI/180;fire({x:Math.sin(a),y:-Math.cos(a)},Number($('power').value)/100);}
$('launch').addEventListener('click',fireFromControls);
for(const id of ['angle','power'])$(id).addEventListener('input',()=>{$(`${id}-value`).textContent=$(id).value+(id==='angle'?'°':'%');});
$('shuffle').addEventListener('click',()=>{opponent=(opponent+1)%regions.length;if(opponent===selected)opponent=(opponent+1)%regions.length;reset();});
$('again').addEventListener('click',reset);
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').setAttribute('aria-pressed',String(sound));$('sound').textContent=sound?'音 ON':'音 OFF';if(sound)tone();});
function setPause(value){aim=null;if(match?.phase!=='active')return;paused=value;accumulator=0;last=0;$('pause-cover').hidden=!paused;$('pause').setAttribute('aria-label',paused?'対戦を再開':'一時停止');$('pause').textContent=paused?'▶':'Ⅱ';}
$('pause').addEventListener('click',()=>setPause(!paused));$('resume').addEventListener('click',()=>setPause(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);});
window.addEventListener('blur',()=>setPause(true));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&match?.phase==='active'){e.preventDefault();setPause(!paused);}});
function pointer(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*440-220,y:(e.clientY-r.top)/r.height*440-220};}
canvas.addEventListener('pointerdown',e=>{if(!match||match.phase!=='ready'||!e.isPrimary)return;const p=pointer(e),b=match.bodies[0];if(Math.hypot(p.x-b.x,p.y-b.y)>BODY_RADIUS+18)return;aim={pointerId:e.pointerId,start:p,end:p};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(aim?.pointerId===e.pointerId)aim={...aim,end:pointer(e)};});
canvas.addEventListener('pointerup',e=>{if(aim?.pointerId!==e.pointerId)return;const a=aim,p=pointer(e),v={x:a.start.x-p.x,y:a.start.y-p.y},length=Math.hypot(v.x,v.y);aim=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(length>7)fire(v,Math.min(1,Math.max(.2,length/85)));});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{aim=null;});
function updateHud(){if(!match)return;$('time').textContent=String(Math.max(0,Math.ceil(MATCH_SECONDS-match.elapsed))).padStart(2,'0');for(let i=0;i<2;i++)$(i?'cpu-energy':'player-energy').style.transform=`scaleX(${match.bodies[i].energy})`;}
function beginFinish(){
 finishEffect=createFinishEffect(match,reduced);$('pause').disabled=true;aim=null;
 $('status').textContent=match.result.winner==='draw'?'決着！':'決着！ 地図が砕け散る！';
 $('arena-caption').textContent=match.result.winner==='draw'?'DRAW':match.result.winner==='player'?'YOU WIN!':'CPU WINS!';
 if(finishEffect.losers.length){tone(110,.4);tone(1000,.13);}
}
function finished(){const {winner,reason}=match.result;const name=regions[selected].name,other=regions[opponent].name;
 $('result-title').textContent=winner==='player'?'あなたの勝ち！':winner==='cpu'?'CPUの勝ち！':'引き分け！';
 $('result-kicker').textContent=winner==='player'?'VICTORY / NICE LAUNCH':winner==='cpu'?'NEXT TIME / TRY AGAIN':'DRAW / GOOD BATTLE';
 const why=reason==='ringout'?'場外で決着':reason==='spin'?'回転スタミナがなくなって決着':'45秒、どちらもゆずらず';
 $('result-detail').textContent=`${name} vs ${other} · ${why}`;$('status').textContent=`${$('result-title').textContent} ${why}`;$('arena-caption').textContent='地域や発射の向きを変えて、もう一戦。';$('result').hidden=false;$('pause').disabled=true;
 // Selection is enabled after a match, but launch remains disabled until reset.
 controls(false);$('launch').disabled=true;tone(winner==='player'?880:260,.3);track('blade_finish',{region:regions[selected].id,winner,reason,duration:Math.round(match.elapsed)});
}
$('share').addEventListener('click',async()=>{if(!match?.result)return;const text=`都市ブレード〈試作版〉 ${regions[selected].name} vs ${regions[opponent].name}：${$('result-title').textContent}`;
 try{if(navigator.share)await navigator.share({title:'都市ブレード',text,url:'https://japan-map.app/blade/'});else if(navigator.clipboard){await navigator.clipboard.writeText(`${text}\nhttps://japan-map.app/blade/`);$('share-status').textContent='結果とリンクをコピーしました。';}else $('share-status').textContent='このページのURLをコピーして共有できます。';}catch(e){if(e.name!=='AbortError')$('share-status').textContent='このページのURLをコピーして共有できます。';}});
function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);}
function path(points,scale=1){ctx.beginPath();for(let i=0;i<points.length;i++){const p=points[i],x=(p.x??p[0])*scale,y=(p.y??p[1])*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
function draw(t){if(!ctx)return;const w=canvas.width;ctx.setTransform(w/440,0,0,w/440,w/2,w/2);ctx.clearRect(-220,-220,440,440);
 const floor=ctx.createRadialGradient(0,-30,5,0,0,220);floor.addColorStop(0,'#1b3b54');floor.addColorStop(1,'#0d1c30');ctx.fillStyle=floor;ctx.fillRect(-220,-220,440,440);
 const shake=finishShake(finishEffect);ctx.translate(shake.x,shake.y);
 ctx.save();circle(0,0,ARENA_RADIUS);ctx.clip();ctx.strokeStyle='#86a9c00a';ctx.lineWidth=1;for(let x=-200;x<=200;x+=20){ctx.beginPath();ctx.moveTo(x,-200);ctx.lineTo(x,200);ctx.stroke();ctx.beginPath();ctx.moveTo(-200,x);ctx.lineTo(200,x);ctx.stroke();}
 const glow=ctx.createRadialGradient(0,0,30,0,0,180);glow.addColorStop(0,'#71e6df0b');glow.addColorStop(1,'#71e6df00');ctx.fillStyle=glow;ctx.fillRect(-180,-180,360,360);ctx.restore();
 circle(0,5,185);ctx.strokeStyle='#071221';ctx.lineWidth=12;ctx.stroke();circle(0,0,180);ctx.strokeStyle='#38576e';ctx.lineWidth=4;ctx.stroke();circle(0,0,174);ctx.strokeStyle='#7ab6c342';ctx.lineWidth=1;ctx.stroke();circle(0,0,110);ctx.strokeStyle='#7695ae17';ctx.setLineDash([3,7]);ctx.stroke();ctx.setLineDash([]);
 for(let i=0;i<48;i++){const a=i*Math.PI/24;ctx.strokeStyle=i%4===0?'#9fc7d080':'#57748a50';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(Math.sin(a)*186,Math.cos(a)*186);ctx.lineTo(Math.sin(a)*(i%4===0?193:189),Math.cos(a)*(i%4===0?193:189));ctx.stroke();}
 ctx.strokeStyle='#7197ad40';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.moveTo(0,-8);ctx.lineTo(0,8);ctx.stroke();
 ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillStyle='#8fa7bd';ctx.fillText('CITY BLADE  /  GEOGRAPHY ARENA',0,-204);ctx.fillStyle='#7b93ab';ctx.fillText('SHAPE × SPIN',0,205);
 if(!match)return;
 for(const hit of match.impacts){const opacity=Math.max(0,1-(hit.age+(finishEffect?.age??0))/.45);ctx.save();ctx.globalAlpha=opacity;circle(hit.x,hit.y,6+hit.age*90);ctx.lineWidth=2;ctx.strokeStyle='#ffedb1';ctx.stroke();for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.moveTo(hit.x+Math.cos(a)*(8+hit.age*40),hit.y+Math.sin(a)*(8+hit.age*40));ctx.lineTo(hit.x+Math.cos(a)*(13+hit.age*70),hit.y+Math.sin(a)*(13+hit.age*70));ctx.stroke();}ctx.restore();}
 for(let i=1;i>=0;i--){if(hiddenByFinish(finishEffect,i))continue;const original=match.bodies[i];
 const b=finishEffect&&!finishEffect.reduced&&!finishEffect.losers.includes(i)?{...original,angle:original.angle+original.cruiseSpin*finishEffect.age*.6}:original;
 ctx.save();if(finishEffect?.reduced&&finishEffect.losers.includes(i))ctx.globalAlpha=Math.max(0,1-finishEffect.age/finishEffect.duration);ctx.translate(b.x,b.y);circle(2,8,28);ctx.fillStyle='#0005';ctx.shadowColor='#0008';ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;
 if(match.phase==='active'){ctx.save();ctx.rotate(b.angle);ctx.strokeStyle=colors[i]+'44';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*.8);ctx.stroke();ctx.beginPath();ctx.arc(0,0,39,Math.PI,Math.PI*1.4);ctx.stroke();ctx.restore();}
 ctx.save();ctx.rotate(b.angle);ctx.translate(0,3);path(b.region.points,BODY_RADIUS);ctx.fillStyle=i?'#8d6637':'#287b80';ctx.fill();ctx.translate(0,-3);path(b.region.points,BODY_RADIUS);const top=ctx.createLinearGradient(-25,-25,25,25);top.addColorStop(0,i?'#fff2c9':'#b8fff5');top.addColorStop(1,colors[i]);ctx.fillStyle=top;ctx.fill();ctx.lineWidth=1;ctx.strokeStyle=i?'#fff4d6':'#ddfff7';ctx.stroke();circle(0,0,4);ctx.fillStyle='#17374a';ctx.fill();circle(0,0,1.6);ctx.fillStyle='#ebffff';ctx.fill();ctx.restore();
 ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillStyle=colors[i];ctx.fillText(b.region.name,0,49);
 if(match.phase==='ready'&&i===0){const pulse=reduced?1:1+Math.sin(t*.003)*.04;circle(0,0,43*pulse);ctx.setLineDash([3,5]);ctx.strokeStyle='#71e6df60';ctx.stroke();ctx.setLineDash([]);}ctx.restore();}
 drawFinishEffect(ctx,finishEffect,match.bodies);
 if(match.phase==='ready'){const b=match.bodies[0];let dx,dy,power;if(aim){dx=aim.start.x-aim.end.x;dy=aim.start.y-aim.end.y;power=Math.min(1,Math.hypot(dx,dy)/85);}else{const a=Number($('angle').value)*Math.PI/180;dx=Math.sin(a);dy=-Math.cos(a);power=Number($('power').value)/100;}const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,end={x:b.x+ux*(45+power*55),y:b.y+uy*(45+power*55)};ctx.strokeStyle='#71e6df';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(b.x+ux*38,b.y+uy*38);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(end.x-ux*8-uy*5,end.y-uy*8+ux*5);ctx.lineTo(end.x,end.y);ctx.lineTo(end.x-ux*8+uy*5,end.y-uy*8-ux*5);ctx.stroke();}
}
function tick(t){const dt=last?Math.min((t-last)/1000,.1):0;last=t;
 if(match?.phase==='active'&&!paused){accumulator+=dt;let loops=0;while(accumulator>=1/120&&loops++<12){match=step(match,1/120);accumulator-=1/120;if(match.phase==='finished'){beginFinish();accumulator=0;break;}}const fresh=match.impacts.find(p=>p.age<.015);if(match.phase==='active'&&fresh&&match.elapsed-lastHit>.12){tone(180,.045);lastHit=match.elapsed;}updateHud();}
 if(finishEffect&&!finishEffect.done&&!document.hidden){finishEffect=advanceFinishEffect(finishEffect,dt);if(finishEffect.done)finished();}
 draw(t);requestAnimationFrame(tick);
}
function resize(){canvas.width=canvas.height=Math.round(canvas.getBoundingClientRect().width*Math.min(devicePixelRatio||1,2));}
new ResizeObserver(resize).observe(canvas);
async function init(){try{if(!ctx)throw new Error('Canvas unsupported');const response=await fetch('./regions.json');if(!response.ok)throw new Error('Map load failed');regions=await response.json();if(!Array.isArray(regions)||regions.length<2)throw new Error('Invalid maps');
 for(const [i,r] of regions.entries()){if(!Array.isArray(r.points)||r.points.length<3||!r.url.startsWith('/play/'))throw new Error('Invalid map');const b=document.createElement('button');b.className='region-card';b.type='button';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',`${r.name}を選ぶ`);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','-1.1 -1.1 2.2 2.2');svg.setAttribute('aria-hidden','true');const polygon=document.createElementNS(svg.namespaceURI,'polygon');polygon.setAttribute('points',r.points.map(p=>p.join(',')).join(' '));svg.append(polygon);const name=document.createElement('strong');name.textContent=r.name;const label=document.createElement('small');label.textContent=r.kind==='市'?r.prefecture:'都道府県';b.append(svg,name,label);b.addEventListener('click',()=>{selected=i;if(opponent===i)opponent=(i+1)%regions.length;reset();});$('regions').append(b);}
 selected=Math.max(0,regions.findIndex(r=>r.id==='city-osaka'));opponent=0;reset();resize();requestAnimationFrame(tick);
 }catch(error){$('status').textContent='地図を読み込めませんでした。ページを再読み込みしてください。';$('region-hint').textContent='通信環境をご確認ください。';$('arena-caption').textContent='読み込みエラー';console.error('City Blade initialization failed:',error);}}
init();
