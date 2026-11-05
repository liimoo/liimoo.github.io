import {mountPicker} from './picker.mjs?v=20261105-national';
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
export function mountFlow({regions,getSelection,select,startBattle,leave}){
 let screen='title',side='player',timer=null,picker=null;
 const screens={title:$('title-screen'),select:$('choose-region'),vs:$('vs-screen'),battle:$('battle')};
 function refresh(){
  const {selected,opponent}=getSelection();
  for(const id of ['match-preview','vs-preview']){
   const vs=document.createElement('b');vs.className='versus-mark';vs.textContent='VS';
   $(id).replaceChildren(preview(regions[selected],'player'),vs,preview(regions[opponent],'cpu'));
  }
  $('select-player').setAttribute('aria-pressed',String(side==='player'));
  $('select-cpu').setAttribute('aria-pressed',String(side==='cpu'));
  $('opponent-name').textContent=regions[opponent].name;
  const region=regions[side==='player'?selected:opponent];
  $('region-kind').textContent=region.name!==region.prefecture?`${region.prefecture} / 市区町村のかたち`:'都道府県のかたち';
  $('region-hint').textContent=region.hint;$('region-link').href=region.url;
  picker?.refresh();
 }
 function show(next){
  if(!Object.hasOwn(screens,next))return;
  clearTimeout(timer);timer=null;
  if(next!=='battle')leave();
  screen=next;
  for(const [name,element] of Object.entries(screens))element.hidden=name!==next;
  document.body.dataset.screen=next;
  if(next==='select'||next==='vs')refresh();
  if(next==='battle')startBattle();
  const focus={title:'mode-heading',select:'selection-heading',vs:'vs-heading',battle:'battle'}[next];
  $(focus).focus({preventScroll:true});screens[next].scrollIntoView({block:'start',behavior:'instant'});
  if(next==='vs')timer=setTimeout(()=>{if(screen==='vs')show('battle');},matchMedia('(prefers-reduced-motion: reduce)').matches?200:1400);
 }
 picker=mountPicker({regions,getSelected:()=>{const {selected,opponent}=getSelection();return side==='player'?selected:opponent;},onSelect:index=>{select(index,side);refresh();}});
 for(const name of ['player','cpu'])$(`select-${name}`).addEventListener('click',()=>{side=name;picker.reset();refresh();});
 for(const [id,target] of Object.entries({'start-exhibition':'select','title-back':'title','confirm-match':'vs','skip-vs':'battle','vs-back':'select','reselect':'select','result-title-home':'title','battle-back':'select'}))$(id).addEventListener('click',()=>show(target));
 $('start-exhibition').disabled=false;show('title');
 return {show,refresh,get screen(){return screen;},get side(){return side;}};
}
