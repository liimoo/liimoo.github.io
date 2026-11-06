import {criticalPresentations} from './critical-presentation.mjs?v=20261106-sides';
import {VIEW_TILT,screenToWorld,floorOffset,drawArenaDepth,drawBowlFloor,drawTop} from './depth-view.mjs?v=20261105-basin';
import {mountFlow} from './flow.mjs?v=20261106-sort';
import {chooseCity,defaultTeam} from './team-roster.mjs?v=20261105-team-panel';
import {createTeamEffects,collectTeamEffects,advanceTeamEffects,teamBody,teamHidden,drawTeamEffects,teamFinishDone} from './team-effects.mjs?v=20261105-basin';
import {createBladeAudio} from './audio.mjs?v=20261106-sides';
import {createFinishEffect,advanceFinishEffect,hiddenByFinish,finishBody,canExplode,finishShake,drawFinishEffect} from './finish-effects.mjs?v=20261105-basin';
import {createMatch,createTeamMatch,launch,launchTeam,step,ARENA_RADIUS,BODY_RADIUS,MATCH_SECONDS} from './engine.mjs?v=20261106-sides';
const $=id=>document.getElementById(id);
const canvas=$('arena'),ctx=canvas.getContext('2d');
let arenaLayer=null;
let regions=[],selected=0,opponent=1,match=null,aim=null,seed=1,paused=false,last=0,accumulator=0,sound=false,flow=null,lastImpactId=0,criticalFlashes=[],finishEffect=null,mode='single',playerTeam=[],cpuTeam=[],teamEffects=createTeamEffects(),resultShown=false;
let launchSettings=[],launchCity=0;
const launchHome=$('launch').parentElement;
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
 launchTabs.hidden=true;launchTabs.replaceChildren();
 const team=mode==='team';
 if(team&&match){canvas.tabIndex=0;canvas.setAttribute('aria-label',`${match.bodies[launchCity].region.name}の発射を調整中。駒をタップ、または左右キーで都市を選択`);}
 else{canvas.removeAttribute('tabindex');canvas.setAttribute('aria-label','地図コマの対戦場。舞台内の角度・強さを調整し、発射ボタンで開始します。');}
}
canvas.addEventListener('keydown',event=>{
 if(mode!=='team'||match?.phase!=='ready'||!['ArrowLeft','ArrowRight'].includes(event.key))return;
 event.preventDefault();launchCity=(launchCity+(event.key==='ArrowRight'?1:2))%3;syncLaunchSliders();refreshLaunchControls();
});
function syncLaunchSliders(){
 const setting=launchSettings[launchCity];
 for(const id of ['angle','power']){$(id).value=setting[id];$(`${id}-value`).textContent=setting[id]+(id==='angle'?'°':'%');}
}
function prepareLaunchControls(){
 launchCity=0;launchSettings=Array.from({length:3},()=>({angle:0,power:75}));
 const team=mode==='team';$('battle').classList.toggle('team-battle',team);$('launch').classList.add('stage-launch');
 stageControls.hidden=false;
 stageControls.append(launchTabs,launchHome);launchHome.append($('launch'));
 syncLaunchSliders();refreshLaunchControls();
 document.querySelector('.control-note').textContent=team?'駒をタップして選び、引っ張るかスライダーで角度・強さを調整。「発射する」を押すまで始まりません。':'駒を引っ張るかスライダーで角度・強さを調整。「発射する」を押すまで始まりません。';
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
 $('status').textContent=mode==='team'?'都市ごとに角度と強さを調整し、舞台のボタンで一斉発射。':'角度と強さを調整し、舞台のボタンで発射。';$('arena-caption').textContent=mode==='team'?'青の3都市があなたのチーム':'引っ張って調整し、ボタンで発射';$('share-status').textContent='';
 document.querySelectorAll('.region-card').forEach((b,i)=>b.setAttribute('aria-pressed',String(Number(b.dataset.index)===selected)));controls(false);updateHud();resize();draw(0);flow?.refresh();
}
function controls(active){for(const el of document.querySelectorAll('.region-card,#shuffle,#launch,#angle,#power,#launch-cities button,#battle-back'))el.disabled=active;}
function fire(direction,power){if(flow?.screen!=='battle'||!match||match.phase!=='ready')return;match=mode==='team'?launchTeam(match,launchSettings.map(setting=>{const a=setting.angle*Math.PI/180;return {direction:{x:Math.sin(a),y:-Math.cos(a)},power:setting.power/100};})):launch(match,direction,power);$('launch').hidden=true;stageControls.hidden=true;aim=null;controls(true);$('pause').disabled=false;$('status').textContent='相手を場外へ！ 発射後は自動で進みます。';$('arena-caption').textContent='青があなた ／ 金がCPU';gameAudio.play('launch');track('blade_start',{mode,region:regions[selected].id,opponent:regions[opponent].id});}
function fireFromControls(){const a=Number($('angle').value)*Math.PI/180;fire({x:Math.sin(a),y:-Math.cos(a)},Number($('power').value)/100);}
$('launch').addEventListener('click',fireFromControls);
for(const id of ['angle','power'])$(id).addEventListener('input',()=>{launchSettings=launchSettings.map((setting,i)=>i===launchCity?{...setting,[id]:Number($(id).value)}:setting);refreshLaunchControls();$(`${id}-value`).textContent=$(id).value+(id==='angle'?'°':'%');});
$('shuffle').addEventListener('click',()=>{const candidates=regions.map((_,i)=>i).filter(i=>mode==='team'?regions[i].name===regions[i].prefecture&&regions[i].prefecture!==teamName('player'):i!==selected&&i!==opponent);opponent=candidates[Math.floor(Math.random()*candidates.length)]??(selected+1)%regions.length;if(mode==='team'){cpuTeam=defaultTeam(regions,opponent);opponent=cpuTeam[0];}flow?.refresh();gameAudio.play('select');});
$('again').addEventListener('click',()=>flow?.show('vs'));
$('sound').addEventListener('click',async()=>{sound=!sound;$('sound').setAttribute('aria-pressed',String(sound));$('sound').textContent=sound?'音 ON':'音 OFF';if(sound){const enabled=await gameAudio.enable();if(enabled&&sound)gameAudio.play('select');}else gameAudio.disable();});
function setPause(value){aim=null;if(match?.phase!=='active')return;paused=value;if(value)gameAudio.stop();accumulator=0;last=0;$('pause-cover').hidden=!paused;$('pause').setAttribute('aria-label',paused?'対戦を再開':'一時停止');$('pause').textContent=paused?'▶':'Ⅱ';}
$('pause').addEventListener('click',()=>setPause(!paused));$('resume').addEventListener('click',()=>setPause(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden){gameAudio.stop();setPause(true);}});
window.addEventListener('blur',()=>{gameAudio.stop();setPause(true);});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&match?.phase==='active'){e.preventDefault();setPause(!paused);}});
function pointer(e){const r=canvas.getBoundingClientRect();return screenToWorld({x:(e.clientX-r.left)/r.width*440-220,y:(e.clientY-r.top)/r.height*440-220});}
canvas.addEventListener('pointerdown',e=>{if(flow?.screen!=='battle'||!match||match.phase!=='ready'||!e.isPrimary)return;const p=pointer(e),b=match.bodies.find(b=>b.side==='player'&&Math.hypot(p.x-b.x,p.y-b.y)<=BODY_RADIUS+18);if(!b)return;if(mode==='team'){launchCity=match.bodies.indexOf(b);syncLaunchSliders();refreshLaunchControls();}aim={pointerId:e.pointerId,start:p,end:p,bodyIndex:match.bodies.indexOf(b)};canvas.setPointerCapture(e.pointerId);});
function adjustAim(end){
 if(!aim)return;
 const dx=aim.start.x-end.x,dy=aim.start.y-end.y,length=Math.hypot(dx,dy);
 if(length<=7)return;
 const angle=Math.round(Math.max(-65,Math.min(65,Math.atan2(dx,-dy)*180/Math.PI)));
 const power=Math.round(Math.max(20,Math.min(100,length/85*100)));
 launchSettings=launchSettings.map((setting,i)=>i===aim.bodyIndex?{angle,power}:setting);
 syncLaunchSliders();refreshLaunchControls();
}
canvas.addEventListener('pointermove',e=>{if(aim?.pointerId===e.pointerId){aim={...aim,end:pointer(e)};adjustAim(aim.end);}});
canvas.addEventListener('pointerup',e=>{if(aim?.pointerId!==e.pointerId)return;adjustAim(pointer(e));aim=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
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
function bodyBounce(body){
 if(reduced||body.eliminated||body.energy<=0)return 0;
 const finalAge=finishEffect?.age??teamEffects.final?.age??0;
 return Math.max(0,...match.impacts.map(hit=>{
  const age=hit.age+finalAge;
  if(age>=.24||Math.hypot(hit.x-body.x,hit.y-body.y)>60)return 0;
  return 5*Math.sin(age/.24*Math.PI)*(1-age/.24);
 }));
}
function draw(t){if(!ctx)return;const w=canvas.width;ctx.setTransform(w/440,0,0,w/440,w/2,w/2);ctx.clearRect(-220,-220,440,440);
 const floor=ctx.createRadialGradient(0,-30,5,0,0,220);floor.addColorStop(0,'#1b3b54');floor.addColorStop(1,'#0d1c30');ctx.fillStyle=floor;ctx.fillRect(-220,-220,440,440);
 const shake=finishShake(finishEffect);ctx.translate(shake.x,shake.y);
 if(!arenaLayer||arenaLayer.width!==w){
  arenaLayer=document.createElement('canvas');arenaLayer.width=arenaLayer.height=w;
  const floorCtx=arenaLayer.getContext('2d');floorCtx.setTransform(w/440,0,0,w/440,w/2,w/2);floorCtx.scale(1,VIEW_TILT);drawArenaDepth(floorCtx);drawBowlFloor(floorCtx);
 }
 ctx.drawImage(arenaLayer,-220,-220,440,440);ctx.scale(1,VIEW_TILT);
 ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillStyle='#8fa7bd';ctx.save();ctx.scale(1,1/VIEW_TILT);ctx.fillText('CITY BLADE  /  GEOGRAPHY ARENA',0,-184);ctx.restore();
 if(!match)return;
 for(const hit of match.impacts){const opacity=Math.max(0,1-(hit.age+(finishEffect?.age??teamEffects.final?.age??0))/.45);ctx.save();ctx.globalAlpha=opacity;circle(hit.x,hit.y+floorOffset(hit),6+hit.age*90);ctx.lineWidth=2;ctx.strokeStyle='#ffedb1';ctx.stroke();for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.moveTo(hit.x+Math.cos(a)*(8+hit.age*40),hit.y+floorOffset(hit)+Math.sin(a)*(8+hit.age*40));ctx.lineTo(hit.x+Math.cos(a)*(13+hit.age*70),hit.y+floorOffset(hit)+Math.sin(a)*(13+hit.age*70));ctx.stroke();}ctx.restore();}
 const displayed=match.bodies.map((body,i)=>({i,original:body,body:mode==='team'?teamBody(teamEffects,i,body):finishBody(finishEffect,i,body)})).sort((a,b)=>a.body.y-b.body.y||a.i-b.i);
 for(const {i,original,body:b} of displayed){
  if(mode==='team'?teamHidden(teamEffects,i):hiddenByFinish(finishEffect,i))continue;
  const cpu=b.side==='cpu',color=colors[cpu?1:0];
  const bounce=bodyBounce(b);
  const alpha=finishEffect?.reduced&&finishEffect.losers.includes(i)?Math.max(0,1-finishEffect.age/finishEffect.duration):1;
  drawTop(ctx,b,{color,cpu,bounce:bounce/5,reduced,alpha});
  ctx.save();ctx.translate(b.x,b.y+floorOffset(b));
  if(match.phase==='active'&&!original.eliminated){ctx.save();ctx.translate(0,-10-bounce);ctx.rotate(b.angle);ctx.strokeStyle=color+'22';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*.8);ctx.stroke();ctx.restore();}
  ctx.save();ctx.translate(0,44);ctx.scale(1,1/VIEW_TILT);ctx.font='8px sans-serif';ctx.textAlign='center';ctx.lineWidth=2.5;ctx.strokeStyle='#0a2031';ctx.strokeText(b.region.name,0,0);ctx.fillStyle=color;ctx.fillText(b.region.name,0,0);ctx.restore();
  if(match.phase==='ready'&&i===(mode==='team'?launchCity:0)){const pulse=reduced?1:1+Math.sin(t*.003)*.04;circle(0,0,43*pulse);ctx.setLineDash([3,5]);ctx.strokeStyle='#71e6df90';ctx.stroke();ctx.setLineDash([]);}ctx.restore();
 }
 drawCriticalFlashes();
 ctx.save();ctx.translate(0,-10);if(mode==='team')drawTeamEffects(ctx,teamEffects,match.bodies);else drawFinishEffect(ctx,finishEffect,match.bodies);ctx.restore();
 if(match.phase==='ready')for(const index of mode==='team'?[0,1,2]:[aim?.bodyIndex??0]){const b=match.bodies[index];let dx,dy,power;{const setting=launchSettings[index];const a=setting.angle*Math.PI/180;dx=Math.sin(a);dy=-Math.cos(a);power=setting.power/100;}const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,end={x:b.x+ux*(45+power*55),y:b.y+uy*(45+power*55)};ctx.strokeStyle='#71e6df';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();for(let n=0;n<=12;n++){const d=38+(7+power*55)*n/12,p={x:b.x+ux*d,y:b.y+uy*d};n?ctx.lineTo(p.x,p.y+floorOffset(p)):ctx.moveTo(p.x,p.y+floorOffset(p));}ctx.stroke();ctx.setLineDash([]);ctx.beginPath();const tipA={x:end.x-ux*8-uy*5,y:end.y-uy*8+ux*5},tipB={x:end.x-ux*8+uy*5,y:end.y-uy*8-ux*5};ctx.moveTo(tipA.x,tipA.y+floorOffset(tipA));ctx.lineTo(end.x,end.y+floorOffset(end));ctx.lineTo(tipB.x,tipB.y+floorOffset(tipB));ctx.stroke();}
}
function collectImpacts(){
 for(const hit of match.impacts){
  // Read every fixed step: an impact can age past the frame before rendering.
  if(hit.id!==undefined?hit.id<=lastImpactId:hit.age!==0)continue;
  if(hit.id!==undefined)lastImpactId=hit.id;
  const critical=hit.criticalAttackers?.length>0;
  const presentations=critical?criticalPresentations(hit,match.bodies):[];
  if(presentations.length){
   for(const enemy of new Set(presentations.map(p=>p.enemy)))gameAudio.play('critical',{enemy,decisive:match.phase==='finished'});
   criticalFlashes=[...criticalFlashes,{...hit,presentations,age:0}];
  }else gameAudio.play('hit',{decisive:match.phase==='finished'});
 }
}
function drawCriticalFlashes(){
 for(const flash of criticalFlashes)for(const [slot,event] of flash.presentations.entries()){
  const fade=Math.max(0,1-flash.age/CRITICAL_FLASH_SECONDS);
  ctx.save();ctx.globalAlpha=fade*(reduced?.35:.8);ctx.strokeStyle=event.color;ctx.fillStyle=event.color;ctx.lineWidth=2;
  if(!reduced){ctx.shadowColor=event.color;ctx.shadowBlur=10;}
  circle(flash.x,flash.y+floorOffset(flash),reduced?5:5+flash.age*34);ctx.fill();
  if(!reduced)for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;ctx.beginPath();ctx.moveTo(flash.x+Math.cos(a)*8,flash.y+floorOffset(flash)+Math.sin(a)*8);ctx.lineTo(flash.x+Math.cos(a)*(18+flash.age*20),flash.y+floorOffset(flash)+Math.sin(a)*(18+flash.age*20));ctx.stroke();}
  for(const i of [event.attacker]){
   if(mode==='team'?teamHidden(teamEffects,i):hiddenByFinish(finishEffect,i))continue;
   const b=mode==='team'?teamBody(teamEffects,i,match.bodies[i]):finishBody(finishEffect,i,match.bodies[i]);ctx.save();ctx.translate(b.x,b.y+floorOffset(b)-10-bodyBounce(b));ctx.rotate(b.angle);path(b.region.points,BODY_RADIUS);ctx.globalAlpha=fade*(reduced?.12:.4);ctx.fill();ctx.restore();
  }
  ctx.restore();
  // Keep the brief glow subtle, but leave enough time to identify the event.
  const labelFade=Math.min(1,(CRITICAL_LABEL_SECONDS-flash.age)/.2);
  const x=Math.max(-155,Math.min(155,flash.x));
  const y=Math.max(-160,Math.min(155-(flash.presentations.length-1)*52,flash.y+floorOffset(flash)-48))+slot*52-(reduced?0:Math.min(6,flash.age*12));
  ctx.save();ctx.globalAlpha=Math.max(0,labelFade);ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle='#071827';ctx.fillStyle=event.color;
  ctx.translate(x,y);ctx.scale(1,1/VIEW_TILT);ctx.strokeText(event.label,0,0);ctx.fillText(event.label,0,0);
  if(mode==='team'){ctx.font='bold 8px sans-serif';ctx.strokeText(event.city+'の攻撃',0,14,260);ctx.fillText(event.city+'の攻撃',0,14,260);}
  ctx.restore();
 }
}
function updateCriticalHud(){
 const bars=[...document.querySelectorAll('.scoreboard .energy')];
 for(const bar of bars){bar.style.boxShadow='';bar.removeAttribute('data-critical');}
 if(!match)return;
 for(const flash of criticalFlashes){
  if(flash.age>=.55)continue;
  for(const event of flash.presentations){
   const target=match.bodies[event.defender];
   const bar=mode==='team'?document.querySelector(`.battle-member[data-body="${event.defender}"] .energy`):$(`${target.side}-energy`).parentElement;
   if(!bar)continue;
   const strength=reduced?2:2+Math.sin(flash.age*30)**2*3;
   bar.style.boxShadow=`0 0 0 ${strength}px ${event.color}, 0 0 12px ${event.color}`;
   bar.dataset.critical=event.enemy?'enemy':'player';
  }
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
 updateCriticalHud();if(flow?.screen==='battle')draw(t);requestAnimationFrame(tick);
}
function resize(){const width=canvas.getBoundingClientRect().width;if(width>0)canvas.width=canvas.height=Math.round(width*Math.min(devicePixelRatio||1,2));}
new ResizeObserver(resize).observe(canvas);
async function init(){try{if(!ctx)throw new Error('Canvas unsupported');const response=await fetch('./regions.json?v=20261106-sort');if(!response.ok)throw new Error('Map load failed');regions=await response.json();if(!Array.isArray(regions)||regions.length<2)throw new Error('Invalid maps');
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
