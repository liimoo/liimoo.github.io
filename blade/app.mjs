import {mountFlow} from './flow.mjs?v=20261105-viewport';
import {chooseCity,defaultTeam} from './team-roster.mjs?v=20261105-team-panel';
import {createTeamEffects,collectTeamEffects,advanceTeamEffects,teamBody,teamHidden,drawTeamEffects,teamFinishDone} from './team-effects.mjs?v=20261105-team-panel';
import {createBladeAudio} from './audio.mjs?v=20261105-critical-clear';
import {createFinishEffect,advanceFinishEffect,hiddenByFinish,finishBody,canExplode,finishShake,drawFinishEffect} from './finish-effects.mjs?v=20261105-overkill';
import {createMatch,createTeamMatch,launch,launchTeam,step,ARENA_RADIUS,BODY_RADIUS,MATCH_SECONDS} from './engine.mjs?v=20261105-team-panel';
const $=id=>document.getElementById(id);
const canvas=$('arena'),ctx=canvas.getContext('2d');
let regions=[],selected=0,opponent=1,match=null,aim=null,seed=1,paused=false,last=0,accumulator=0,sound=false,flow=null,lastImpactId=0,criticalFlashes=[],finishEffect=null,mode='single',playerTeam=[],cpuTeam=[],teamEffects=createTeamEffects(),resultShown=false;
let launchSettings=[],launchCity=0;
const launchHome=$('launch').parentElement;
const launchAnchor=document.createComment('launch controls');launchHome.before(launchAnchor);
const stageControls=document.createElement('div');stageControls.id='stage-controls';stageControls.hidden=true;document.querySelector('.arena-wrap').append(stageControls);
const launchTabs=document.createElement('div');launchTabs.id='launch-cities';launchTabs.setAttribute('aria-label','発射を調整する都市');launchHome.before(launchTabs);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const CRITICAL_FLASH_SECONDS=.3,CRITICAL_LABEL_SECONDS=.65;
const colors=['#71e6df','#f6ce80'];
const gameAudio=createBladeAudio();
function track(name,params={}){if(typeof window.gtag==='function')window.gtag('event',name,{...params,page_path:location.pathname});}
function teamName(side){return regions[(side==='player'?playerTeam:cpuTeam)[0]]?.prefecture??'';}
function buildTeamHud(){
 for(const side of ['player','cpu']){const container=$(`${side}-roster`);container.replaceChildren();container.hidden=mode!=='team';if(mode!=='team')continue;
  match.bodies.forEach((body,index)=>{if(body.side!==side)return;const row=document.createElement('div');row.className='battle-member';row.dataset.body=String(index);const name=document.createElement('span');name.textContent=body.region.name;const bar=document.createElement('div');bar.className='energy';const gauge=document.createElement('i');bar.append(gauge);row.append(name,bar);container.append(row);});
 }
}
function refreshLaunchControls(){
 const focused=launchTabs.contains(document.activeElement)?document.activeElement.dataset.city:null;
 launchTabs.hidden=mode!=='team';launchTabs.replaceChildren();
 if(mode!=='team')return;
 launchSettings.forEach((setting,index)=>{const button=document.createElement('button');button.type='button';button.dataset.city=String(index);button.setAttribute('aria-pressed',String(index===launchCity));button.textContent=`${match.bodies[index].region.name} ${setting.angle}° / ${setting.power}%`;button.disabled=match.phase!=='ready';button.addEventListener('click',()=>{launchCity=index;syncLaunchSliders();refreshLaunchControls();});launchTabs.append(button);});
 if(focused!==null)launchTabs.querySelector(`[data-city="${focused}"]`)?.focus({preventScroll:true});
}
function syncLaunchSliders(){
 const setting=launchSettings[launchCity];
 for(const id of ['angle','power']){$(id).value=setting[id];$(`${id}-value`).textContent=setting[id]+(id==='angle'?'°':'%');}
}
function prepareLaunchControls(){
 launchCity=0;launchSettings=Array.from({length:3},()=>({angle:0,power:75}));
 const team=mode==='team';$('battle').classList.toggle('team-battle',team);$('launch').classList.toggle('stage-launch',team);
 stageControls.hidden=!team;
 if(team){stageControls.append(launchTabs,launchHome);launchHome.append($('launch'));}else{launchAnchor.after(launchTabs,launchHome);launchHome.append($('launch'));}
 if(team)syncLaunchSliders();refreshLaunchControls();
 document.querySelector('.control-note').textContent=team?'駒を引っ張るか、都市名とスライダーで角度・強さを調整。「発射する」を押すまで始まりません。':'引っ張る操作の代わりに、上の調整と発射ボタンでも遊べます。';
}
function reset(){
 gameAudio.stop();
 match=mode==='team'?createTeamMatch(playerTeam.map(i=>regions[i]),cpuTeam.map(i=>regions[i]),seed++):createMatch(regions[selected],regions[opponent],seed++);teamEffects=createTeamEffects();resultShown=false;buildTeamHud();prepareLaunchControls();finishEffect=null;aim=null;paused=false;accumulator=0;lastImpactId=0;criticalFlashes=[];
 $('launch').hidden=false;$('result').hidden=true;$('pause-cover').hidden=true;$('pause').disabled=true;$('pause').textContent='Ⅱ';
 $('player-name').textContent=mode==='team'?teamName('player'):regions[selected].name;$('cpu-name').textContent=mode==='team'?teamName('cpu'):regions[opponent].name;$('opponent-name').textContent=regions[opponent].name;
 $('region-kind').textContent=regions[selected].name!==regions[selected].prefecture?`${regions[selected].prefecture} / 市区町村のかたち`:'都道府県のかたち';
 for(const [i,side] of ['player','cpu'].entries()){
  $(`${side}-grit`).textContent=`底力 ${match.bodies.find(b=>b.side===side).grit} / 100`;
  $(`${side}-spin-power`).textContent=`回転力 ${match.bodies.find(b=>b.side===side).spinPower} / 100`;
 }
 $('region-hint').textContent=regions[selected].hint;$('region-link').href=regions[selected].url;
 $('status').textContent=mode==='team'?'都市ごとに角度と強さを調整し、舞台のボタンで一斉発射。':'地域を選んだら、青い地図を引いて発射。';$('arena-caption').textContent=mode==='team'?'青の3都市があなたのチーム':'青い地図を手前に引いて、はなそう';$('share-status').textContent='';
 document.querySelectorAll('.region-card').forEach((b,i)=>b.setAttribute('aria-pressed',String(Number(b.dataset.index)===selected)));controls(false);updateHud();resize();draw(0);flow?.refresh();
}
function controls(active){for(const el of document.querySelectorAll('.region-card,#shuffle,#launch,#angle,#power,#launch-cities button,#battle-back'))el.disabled=active;}
function fire(direction,power){if(flow?.screen!=='battle'||!match||match.phase!=='ready')return;match=mode==='team'?launchTeam(match,launchSettings.map(setting=>{const a=setting.angle*Math.PI/180;return {direction:{x:Math.sin(a),y:-Math.cos(a)},power:setting.power/100};})):launch(match,direction,power);$('launch').hidden=mode==='team';stageControls.hidden=true;aim=null;controls(true);$('pause').disabled=false;$('status').textContent='相手を場外へ！ 発射後は自動で進みます。';$('arena-caption').textContent='青があなた ／ 金がCPU';gameAudio.play('launch');track('blade_start',{mode,region:regions[selected].id,opponent:regions[opponent].id});}
function fireFromControls(){const a=Number($('angle').value)*Math.PI/180;fire({x:Math.sin(a),y:-Math.cos(a)},Number($('power').value)/100);}
$('launch').addEventListener('click',fireFromControls);
for(const id of ['angle','power'])$(id).addEventListener('input',()=>{if(mode==='team'){launchSettings=launchSettings.map((setting,i)=>i===launchCity?{...setting,[id]:Number($(id).value)}:setting);refreshLaunchControls();}$(`${id}-value`).textContent=$(id).value+(id==='angle'?'°':'%');});
$('shuffle').addEventListener('click',()=>{const candidates=regions.map((_,i)=>i).filter(i=>mode==='team'?regions[i].name===regions[i].prefecture&&regions[i].prefecture!==teamName('player'):i!==selected&&i!==opponent);opponent=candidates[Math.floor(Math.random()*candidates.length)]??(selected+1)%regions.length;if(mode==='team'){cpuTeam=defaultTeam(regions,opponent);opponent=cpuTeam[0];}flow?.refresh();gameAudio.play('select');});
$('again').addEventListener('click',()=>flow?.show('vs'));
$('sound').addEventListener('click',async()=>{sound=!sound;$('sound').setAttribute('aria-pressed',String(sound));$('sound').textContent=sound?'音 ON':'音 OFF';if(sound){const enabled=await gameAudio.enable();if(enabled&&sound)gameAudio.play('select');}else gameAudio.disable();});
function setPause(value){aim=null;if(match?.phase!=='active')return;paused=value;if(value)gameAudio.stop();accumulator=0;last=0;$('pause-cover').hidden=!paused;$('pause').setAttribute('aria-label',paused?'対戦を再開':'一時停止');$('pause').textContent=paused?'▶':'Ⅱ';}
$('pause').addEventListener('click',()=>setPause(!paused));$('resume').addEventListener('click',()=>setPause(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden){gameAudio.stop();setPause(true);}});
window.addEventListener('blur',()=>{gameAudio.stop();setPause(true);});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&match?.phase==='active'){e.preventDefault();setPause(!paused);}});
function pointer(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*440-220,y:(e.clientY-r.top)/r.height*440-220};}
canvas.addEventListener('pointerdown',e=>{if(flow?.screen!=='battle'||!match||match.phase!=='ready'||!e.isPrimary)return;const p=pointer(e),b=match.bodies.find(b=>b.side==='player'&&Math.hypot(p.x-b.x,p.y-b.y)<=BODY_RADIUS+18);if(!b)return;if(mode==='team'){launchCity=match.bodies.indexOf(b);syncLaunchSliders();refreshLaunchControls();}aim={pointerId:e.pointerId,start:p,end:p,bodyIndex:match.bodies.indexOf(b)};canvas.setPointerCapture(e.pointerId);});
function adjustTeamAim(end){
 if(mode!=='team'||!aim)return;
 const dx=aim.start.x-end.x,dy=aim.start.y-end.y,length=Math.hypot(dx,dy);
 if(length<=7)return;
 const angle=Math.round(Math.max(-65,Math.min(65,Math.atan2(dx,-dy)*180/Math.PI)));
 const power=Math.round(Math.max(20,Math.min(100,length/85*100)));
 launchSettings=launchSettings.map((setting,i)=>i===aim.bodyIndex?{angle,power}:setting);
 syncLaunchSliders();refreshLaunchControls();
}
canvas.addEventListener('pointermove',e=>{if(aim?.pointerId===e.pointerId){aim={...aim,end:pointer(e)};adjustTeamAim(aim.end);}});
canvas.addEventListener('pointerup',e=>{if(aim?.pointerId!==e.pointerId)return;const a=aim,p=pointer(e),v={x:a.start.x-p.x,y:a.start.y-p.y},length=Math.hypot(v.x,v.y);adjustTeamAim(p);aim=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(mode!=='team'&&length>7)fire(v,Math.min(1,Math.max(.2,length/85)));});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{aim=null;});
function updateHud(){if(!match)return;$('time').textContent=String(Math.max(0,Math.ceil(MATCH_SECONDS-match.elapsed))).padStart(2,'0');
 for(const side of ['player','cpu']){const members=match.bodies.filter(b=>b.side===side);$(`${side}-energy`).style.transform=`scaleX(${members.reduce((sum,b)=>sum+(b.eliminated?0:b.energy),0)/members.length})`;}
 if(mode==='team')for(const row of document.querySelectorAll('.battle-member')){const b=match.bodies[Number(row.dataset.body)];row.classList.toggle('eliminated',b.eliminated);row.querySelector('i').style.transform=`scaleX(${b.eliminated?0:b.energy})`;row.setAttribute('aria-label',`${b.region.name} ${b.eliminated?'脱落':`残り${Math.ceil(b.energy*100)}％`}`);}
}
function beginFinish(previousBodies){
 if(mode==='team'){teamEffects=collectTeamEffects(teamEffects,match,reduced);$('pause').disabled=true;aim=null;$('status').textContent='決着！ 最後の都市を見届けよう';return;}
 finishEffect=createFinishEffect(match,reduced,previousBodies);$('pause').disabled=true;aim=null;
 $('status').textContent=match.result.reason==='time'?'決着！ 時間切れ':match.result.reason==='ringout'?'決着！ 場外へ飛ばされました':'決着！ ゲージ切れで回転が止まります';
 $('arena-caption').textContent=match.result.reason==='time'?'時間切れ':match.result.reason==='ringout'?'場外！':'ゲージ切れ → 回転停止';
 if(finishEffect.reason==='ringout')gameAudio.play('ringout');
}
function finished(){resultShown=true;const {winner,reason}=match.result;const name=mode==='team'?teamName('player'):regions[selected].name,other=mode==='team'?teamName('cpu'):regions[opponent].name;
 $('result-title').textContent=winner==='player'?'あなたの勝ち！':winner==='cpu'?'CPUの勝ち！':'引き分け！';
 $('result-kicker').textContent=winner==='player'?'VICTORY / NICE LAUNCH':winner==='cpu'?'NEXT TIME / TRY AGAIN':'DRAW / GOOD BATTLE';
 const why=mode==='team'?(reason==='time'?'時間切れ：残った都市数、合計スタミナの順で判定':winner==='draw'?'両チームが全滅':match.result.tiebreak==='remaining-energy'?'同時に全滅・超過ダメージの少ない側の勝利':'相手の3都市をすべて撃破'):match.result.tiebreak==='remaining-energy'?'同時にゲージ切れ・超過ダメージの少ない側の勝利':reason==='ringout'?'場外で決着':reason==='spin'?'回転スタミナがなくなって決着':'45秒、どちらもゆずらず';
 $('result-detail').textContent=`${name} vs ${other} · ${why}`;$('status').textContent=`${$('result-title').textContent} ${why}`;$('arena-caption').textContent='地域や発射の向きを変えて、もう一戦。';$('result').hidden=false;$('pause').disabled=true;
 // Selection is enabled after a match, but launch remains disabled until reset.
 controls(false);$('launch').disabled=true;gameAudio.play(winner==='player'?'win':winner==='cpu'?'lose':'draw');track('blade_finish',{mode,region:regions[selected].id,winner,reason,duration:Math.round(match.elapsed)});
}
$('share').addEventListener('click',async()=>{if(!match?.result)return;const text=`都市ブレード〈試作版〉 ${mode==='team'?teamName('player'):regions[selected].name} vs ${mode==='team'?teamName('cpu'):regions[opponent].name}：${$('result-title').textContent}`;
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
 for(const hit of match.impacts){const opacity=Math.max(0,1-(hit.age+(finishEffect?.age??teamEffects.final?.age??0))/.45);ctx.save();ctx.globalAlpha=opacity;circle(hit.x,hit.y,6+hit.age*90);ctx.lineWidth=2;ctx.strokeStyle='#ffedb1';ctx.stroke();for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.moveTo(hit.x+Math.cos(a)*(8+hit.age*40),hit.y+Math.sin(a)*(8+hit.age*40));ctx.lineTo(hit.x+Math.cos(a)*(13+hit.age*70),hit.y+Math.sin(a)*(13+hit.age*70));ctx.stroke();}ctx.restore();}
 for(let i=match.bodies.length-1;i>=0;i--){if(mode==='team'?teamHidden(teamEffects,i):hiddenByFinish(finishEffect,i))continue;const original=match.bodies[i],cpu=original.side==='cpu',color=colors[cpu?1:0];
 const b=mode==='team'?teamBody(teamEffects,i,original):finishBody(finishEffect,i,original);
 ctx.save();if(finishEffect?.reduced&&finishEffect.losers.includes(i))ctx.globalAlpha=Math.max(0,1-finishEffect.age/finishEffect.duration);ctx.translate(b.x,b.y);circle(2,8,28);ctx.fillStyle='#0005';ctx.shadowColor='#0008';ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;
 if(match.phase==='active'&&!original.eliminated){ctx.save();ctx.rotate(b.angle);ctx.strokeStyle=color+'44';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*.8);ctx.stroke();ctx.beginPath();ctx.arc(0,0,39,Math.PI,Math.PI*1.4);ctx.stroke();ctx.restore();}
 ctx.save();ctx.rotate(b.angle);ctx.translate(0,3);path(b.region.points,BODY_RADIUS);ctx.fillStyle=cpu?'#8d6637':'#287b80';ctx.fill();ctx.translate(0,-3);path(b.region.points,BODY_RADIUS);const top=ctx.createLinearGradient(-25,-25,25,25);top.addColorStop(0,cpu?'#fff2c9':'#b8fff5');top.addColorStop(1,color);ctx.fillStyle=top;ctx.fill();ctx.lineWidth=1;ctx.strokeStyle=cpu?'#fff4d6':'#ddfff7';ctx.stroke();circle(0,0,4);ctx.fillStyle='#17374a';ctx.fill();circle(0,0,1.6);ctx.fillStyle='#ebffff';ctx.fill();ctx.restore();
 ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(b.region.name,0,49);
 if(match.phase==='ready'&&i===(mode==='team'?launchCity:0)){const pulse=reduced?1:1+Math.sin(t*.003)*.04;circle(0,0,43*pulse);ctx.setLineDash([3,5]);ctx.strokeStyle='#71e6df60';ctx.stroke();ctx.setLineDash([]);}ctx.restore();}
 drawCriticalFlashes();
 if(mode==='team')drawTeamEffects(ctx,teamEffects,match.bodies);else drawFinishEffect(ctx,finishEffect,match.bodies);
 if(match.phase==='ready')for(const index of mode==='team'?[0,1,2]:[aim?.bodyIndex??0]){const b=match.bodies[index];let dx,dy,power;if(aim&&mode!=='team'){dx=aim.start.x-aim.end.x;dy=aim.start.y-aim.end.y;power=Math.min(1,Math.hypot(dx,dy)/85);}else{const setting=mode==='team'?launchSettings[index]:{angle:Number($('angle').value),power:Number($('power').value)};const a=setting.angle*Math.PI/180;dx=Math.sin(a);dy=-Math.cos(a);power=setting.power/100;}const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,end={x:b.x+ux*(45+power*55),y:b.y+uy*(45+power*55)};ctx.strokeStyle='#71e6df';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(b.x+ux*38,b.y+uy*38);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(end.x-ux*8-uy*5,end.y-uy*8+ux*5);ctx.lineTo(end.x,end.y);ctx.lineTo(end.x-ux*8+uy*5,end.y-uy*8-ux*5);ctx.stroke();}
}
function collectImpacts(){
 for(const hit of match.impacts){
  // Read every fixed step: an impact can age past the frame before rendering.
  if(hit.id!==undefined?hit.id<=lastImpactId:hit.age!==0)continue;
  if(hit.id!==undefined)lastImpactId=hit.id;
  const critical=hit.criticalAttackers?.length>0;
  gameAudio.play(critical?'critical':'hit',{decisive:match.phase==='finished'});
  if(critical)criticalFlashes=[...criticalFlashes,{...hit,age:0}];
 }
}
function drawCriticalFlashes(){
 for(const flash of criticalFlashes){
  const fade=Math.max(0,1-flash.age/CRITICAL_FLASH_SECONDS);
  ctx.save();ctx.globalAlpha=fade*(reduced?.35:.8);ctx.strokeStyle='#fff3b0';ctx.fillStyle='#fffce3';ctx.lineWidth=2;
  if(!reduced){ctx.shadowColor='#ffe89a';ctx.shadowBlur=10;}
  circle(flash.x,flash.y,reduced?5:5+flash.age*34);ctx.fill();
  if(!reduced)for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;ctx.beginPath();ctx.moveTo(flash.x+Math.cos(a)*8,flash.y+Math.sin(a)*8);ctx.lineTo(flash.x+Math.cos(a)*(18+flash.age*20),flash.y+Math.sin(a)*(18+flash.age*20));ctx.stroke();}
  for(const i of flash.criticalAttackers){
   if(mode==='team'?teamHidden(teamEffects,i):hiddenByFinish(finishEffect,i))continue;
   const b=mode==='team'?teamBody(teamEffects,i,match.bodies[i]):finishBody(finishEffect,i,match.bodies[i]);ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);path(b.region.points,BODY_RADIUS);ctx.globalAlpha=fade*(reduced?.12:.4);ctx.fill();ctx.restore();
  }
  ctx.restore();
  // Keep the brief glow subtle, but leave enough time to identify the event.
  const labelFade=Math.min(1,(CRITICAL_LABEL_SECONDS-flash.age)/.2);
  const x=Math.max(-155,Math.min(155,flash.x));
  const y=Math.max(-160,Math.min(155,flash.y-48))-(reduced?0:Math.min(6,flash.age*12));
  ctx.save();ctx.globalAlpha=Math.max(0,labelFade);ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle='#071827';ctx.fillStyle='#fff1a8';
  ctx.strokeText('クリティカル！',x,y);ctx.fillText('クリティカル！',x,y);ctx.restore();
 }
}
function tick(t){const dt=last?Math.min((t-last)/1000,.1):0;last=t;
 if(!paused&&!document.hidden)criticalFlashes=criticalFlashes.map(f=>({...f,age:f.age+dt})).filter(f=>f.age<CRITICAL_LABEL_SECONDS);
 if(match?.phase==='active'&&!paused){accumulator+=dt;let loops=0;while(accumulator>=1/120&&loops++<12){const previousBodies=match.bodies;match=step(match,1/120);collectImpacts();if(mode==='team')teamEffects=collectTeamEffects(teamEffects,match,reduced);accumulator-=1/120;if(match.phase==='finished'){beginFinish(previousBodies);accumulator=0;break;}}updateHud();}
 if(mode==='team'&&match&&!paused&&!document.hidden){const next=advanceTeamEffects(teamEffects,dt);teamEffects=next.state;for(const cue of next.cues)gameAudio.play(cue);if(!resultShown&&teamFinishDone(teamEffects,match))finished();}
 if(finishEffect&&!document.hidden){
  const previousAge=finishEffect.age,wasDone=finishEffect.done;finishEffect=advanceFinishEffect(finishEffect,dt);
  if(previousAge<finishEffect.burstAt&&finishEffect.age>=finishEffect.burstAt&&finishEffect.losers.some(i=>canExplode(finishEffect,i))){
   gameAudio.play('break');$('status').textContent='決着！ 地図が砕け散る！';
  }
  if(!wasDone&&finishEffect.done)finished();
 }
 if(flow?.screen==='battle')draw(t);requestAnimationFrame(tick);
}
function resize(){const width=canvas.getBoundingClientRect().width;if(width>0)canvas.width=canvas.height=Math.round(width*Math.min(devicePixelRatio||1,2));}
new ResizeObserver(resize).observe(canvas);
async function init(){try{if(!ctx)throw new Error('Canvas unsupported');const response=await fetch('./regions.json?v=20261105-national');if(!response.ok)throw new Error('Map load failed');regions=await response.json();if(!Array.isArray(regions)||regions.length<2)throw new Error('Invalid maps');
 for(const r of regions){if(!Array.isArray(r.points)||r.points.length<3||!r.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||typeof r.url!=='string'||!r.url.startsWith('/play/'))throw new Error('Invalid map');}
 selected=Math.max(0,regions.findIndex(r=>r.id==='city-osaka'));opponent=0;
 flow=mountFlow({regions,getSelection:()=>({selected,opponent,mode,playerTeam,cpuTeam}),setMode:next=>{mode=next;if(mode==='team'){playerTeam=defaultTeam(regions,selected);cpuTeam=defaultTeam(regions,opponent);selected=playerTeam[0];opponent=cpuTeam[0];}},select:(index,side)=>{
  if(mode==='team'){if(side==='cpu'){cpuTeam=chooseCity(regions,cpuTeam,index);opponent=cpuTeam[0]??index;}else{playerTeam=chooseCity(regions,playerTeam,index);selected=playerTeam[0]??index;}gameAudio.play('select');return;}
  if(side==='cpu'){opponent=index;if(selected===index)selected=(index+1)%regions.length;}
  else{selected=index;if(opponent===index)opponent=(index+1)%regions.length;}
  gameAudio.play('select');
 },startBattle:reset,leave:()=>{gameAudio.stop();match=null;finishEffect=null;teamEffects=createTeamEffects();resultShown=false;criticalFlashes=[];lastImpactId=0;aim=null;paused=false;accumulator=0;last=0;controls(false);$('launch').hidden=false;$('result').hidden=true;$('pause-cover').hidden=true;}});
 $('start-exhibition').disabled=false;$('start-team').disabled=false;$('shuffle').disabled=false;resize();requestAnimationFrame(tick);
 }catch(error){$('load-error').hidden=false;$('load-error').textContent='地図を読み込めませんでした。ページを再読み込みしてください。';$('status').textContent='地図を読み込めませんでした。ページを再読み込みしてください。';$('region-hint').textContent='通信環境をご確認ください。';$('arena-caption').textContent='読み込みエラー';console.error('City Blade initialization failed:',error);}}
init();
