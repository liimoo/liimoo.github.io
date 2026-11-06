import {validTeam as validRoster} from './team-roster.mjs?v=20261105-team';
import {mountPicker} from './picker.mjs?v=20261106-sort';
const $=id=>document.getElementById(id);
const SVG='http://www.w3.org/2000/svg';
function preview(region,side){
 const panel=document.createElement('article');panel.className=`preview-fighter ${side}`;
 const label=document.createElement('small');label.textContent=side==='player'?'YOU':'CPU';
 const map=document.createElementNS(SVG,'svg');map.setAttribute('viewBox','-1.1 -1.1 2.2 2.2');map.setAttribute('aria-hidden','true');
 const polygon=document.createElementNS(SVG,'polygon');polygon.setAttribute('points',region.points.map(p=>p.join(',')).join(' '));map.append(polygon);
 const title=document.createElement('h3');title.textContent=region.name;
 const details=document.createElement('p');details.textContent=region.name===region.prefecture?'県全体':region.prefecture;
 panel.append(label,map,title,details);return panel;
}
export function mountFlow({regions,getSelection,select,startBattle,leave,setMode=()=>{},removeTeam}){
 let screen='title',side='player',timer=null,picker=null;
 const selection=$('choose-region'),topbar=document.createElement('div'),actions=document.createElement('div');
 topbar.className='selection-topbar';topbar.append($('title-back'),selection.querySelector('.section-heading'));
 actions.className='selection-actions';actions.append(selection.querySelector('.opponent-row'),$('confirm-match'));
 const info=document.createElement('details');info.id='selection-info';
 const summary=document.createElement('summary');summary.textContent='説明・編成を確認';
 info.append(summary,selection.querySelector('.selection-scope'),$('match-preview'),selection.querySelector('.selection-note'),selection.querySelector('.prototype-note'));
 info.addEventListener('toggle',()=>{summary.textContent=info.open?'都市選択に戻る':'説明・編成を確認';for(const child of selection.children)if(child!==info)child.inert=info.open;});
 info.addEventListener('keydown',event=>{if(event.key==='Escape'&&info.open){event.preventDefault();info.open=false;summary.focus({preventScroll:true});}});
 selection.prepend(topbar);selection.append(actions,info);

 const teamMode=()=>getSelection().mode==='team';
 const roster=name=>getSelection()[name==='player'?'playerTeam':'cpuTeam']||[];
 const validTeam=items=>validRoster(regions,items);
 function teamPreview(name){
  const panel=document.createElement('article');panel.className=`preview-team ${name}`;
  const heading=document.createElement('h3');heading.textContent=`${name==='player'?'YOU':'CPU'} / ${regions[roster(name)[0]]?.prefecture||'県を選択'}`;panel.append(heading);
  const cities=document.createElement('div');cities.className='preview-cities';
  for(const i of roster(name))cities.append(preview(regions[i],name));panel.append(cities);return panel;
 }
 function refreshRoster(){
  const team=teamMode();document.querySelector('#vs-screen>.step').textContent=team?'EXHIBITION / 3 vs 3 (県対抗)':'EXHIBITION / 1 vs 1';$('team-roster').hidden=!team;$('team-selection-status').hidden=!team;
  $('selection-heading').textContent=team?'県の3都市を選ぼう':'地域を選ぼう';
  $('select-player').textContent=team?`あなた ${roster('player').length}/3都市`:'あなたの地域';$('select-cpu').textContent=team?`CPU ${roster('cpu').length}/3都市`:'CPUの地域';
  info.querySelector('.selection-scope').textContent=team?'1チームは同じ都道府県の3都市です。別の県の都市を選ぶと、そのチームの選択をやり直します。':'全国の都道府県・市区町村から選べます。左の都道府県から、使う地域を選ぼう。';
  const indices=roster(side),fragment=document.createDocumentFragment();
  for(let slot=0;slot<3;slot++){const index=indices[slot],button=document.createElement('button');button.type='button';button.className='team-slot';button.disabled=index===undefined;button.textContent=index===undefined?`${slot+1}. 都市を選択`:`${slot+1}. ${regions[index].name} ×`;if(index!==undefined){button.setAttribute('aria-label',`${regions[index].name}をチームから外す`);button.addEventListener('click',()=>{(removeTeam||select)(index,side);refresh();});}fragment.append(button);}
  $('team-roster').replaceChildren(fragment);
  $('team-selection-status').textContent=`${side==='player'?'あなた':'CPU'}：${indices.length}/3都市${indices.length===3?'。変更するときは先に1都市を外してください。':''}`;
  $('confirm-match').textContent='この編成で対戦 →';
  $('confirm-match').disabled=team&&(!validTeam(roster('player'))||!validTeam(roster('cpu')));
 }
 const screens={title:$('title-screen'),select:$('choose-region'),vs:$('vs-screen'),battle:$('battle')};
 function refresh(){
  const {selected,opponent}=getSelection();
  for(const id of ['match-preview','vs-preview']){
   const vs=document.createElement('b');vs.className='versus-mark';vs.textContent='VS';
   $(id).classList.toggle('team-preview',teamMode());
   $(id).replaceChildren(teamMode()?teamPreview('player'):preview(regions[selected],'player'),vs,teamMode()?teamPreview('cpu'):preview(regions[opponent],'cpu'));

  }
  $('select-player').setAttribute('aria-pressed',String(side==='player'));
  $('select-cpu').setAttribute('aria-pressed',String(side==='cpu'));
  $('opponent-name').textContent=teamMode()?`${regions[roster('cpu')[0]]?.prefecture||'未選択'} / ${roster('cpu').length}都市`:regions[opponent].name;
  refreshRoster();
  const region=regions[side==='player'?selected:opponent];
  $('region-kind').textContent=region.name!==region.prefecture?`${region.prefecture} / 市区町村のかたち`:'都道府県のかたち';
  $('region-hint').textContent=region.hint;$('region-link').href=region.url;
  picker?.refresh();
 }
 function show(next){
  if(!Object.hasOwn(screens,next))return;
  if((next==='vs'||next==='battle')&&teamMode()&&(!validTeam(roster('player'))||!validTeam(roster('cpu'))))return;
  clearTimeout(timer);timer=null;
  if(next!=='battle')leave();
  screen=next;
  for(const [name,element] of Object.entries(screens))element.hidden=name!==next;
  document.body.dataset.screen=next;info.open=false;
  for(const element of document.querySelectorAll('main > :not(.game-layout),.site-head'))element.inert=next==='select';
  if(next==='select'||next==='vs')refresh();
  if(next==='battle')startBattle();
  const focus={title:'mode-heading',select:'selection-heading',vs:'vs-heading',battle:'battle'}[next];
  $(focus).focus({preventScroll:true});screens[next].scrollIntoView({block:'start',behavior:'instant'});
  if(next==='vs')timer=setTimeout(()=>{if(screen==='vs')show('battle');},matchMedia('(prefers-reduced-motion: reduce)').matches?200:1400);
 }
 picker=mountPicker({regions,getSelected:()=>{const {selected,opponent}=getSelection();return side==='player'?selected:opponent;},getSelectedIndices:()=>teamMode()?roster(side):[side==='player'?getSelection().selected:getSelection().opponent],isTeam:teamMode,onSelect:index=>{select(index,side);refresh();}});
 for(const name of ['player','cpu'])$(`select-${name}`).addEventListener('click',()=>{side=name;picker.reset();refresh();});
 for(const [id,target] of Object.entries({'title-back':'title','confirm-match':'vs','skip-vs':'battle','vs-back':'select','reselect':'select','result-title-home':'title','battle-back':'select'}))$(id).addEventListener('click',()=>show(target));
 for(const [id,mode] of [['start-exhibition','single'],['start-team','team']]){$(id).addEventListener('click',()=>{setMode(mode);side='player';picker.reset();show('select');});$(id).disabled=false;}
 show('title');
 return {show,refresh,get screen(){return screen;},get side(){return side;}};
}
