import {regionStats} from './engine.mjs?v=20261105-overkill';
const $=id=>document.getElementById(id),SVG='http://www.w3.org/2000/svg';
const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
export function mountPicker({regions,getSelected,onSelect}){
 let prefecture='',maps=null,mapRequested=false,mapFailed=false;
 const order=['北海道','青森県','千葉県','神奈川県','愛知県','京都府','大阪府','沖縄県'];
 const readings={'神奈川県':'かながわけん','愛知県':'あいちけん','京都府':'きょうとふ'};
 const names=[...new Set(regions.map(r=>r.prefecture))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
 function choosePrefecture(name){prefecture=name;refresh();document.querySelector('.picker-sidebar').scrollTop=0;}
 for(const name of names){
  const button=element('button');button.className='prefecture-card';button.dataset.prefecture=name;
  button.append(element('small',regions.find(r=>r.name===name)?.reading||readings[name]||'都道府県'),element('strong',`${name} ›`));
  button.addEventListener('click',()=>choosePrefecture(name));$('prefecture-list').append(button);
 }
 $('prefecture-back').addEventListener('click',()=>choosePrefecture(''));
 document.querySelectorAll('.region-card').forEach(card=>card.addEventListener('click',()=>{onSelect(Number(card.dataset.index));refresh();}));
 function drawMap(){
  const svg=$('selection-map');svg.replaceChildren();
  const selected=regions[getSelected()];
  const source=maps?(prefecture?maps.cities[prefecture]:maps.prefectures):[];
  if(!source?.length){
   const polygon=document.createElementNS(SVG,'polygon');polygon.setAttribute('points',selected.points.map(p=>p.join(',')).join(' '));polygon.classList.add('map-selected');svg.append(polygon);svg.setAttribute('viewBox','-1.2 -1.2 2.4 2.4');return;
  }
  const points=source.flatMap(r=>r.polygons.flat());
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.max(w,h)*.04;
  svg.setAttribute('viewBox',`${x-pad} ${y-pad} ${w+pad*2} ${h+pad*2}`);
  for(const region of source){
   const index=regions.findIndex(r=>r.name===region.name&&r.prefecture===prefecture);
   const available=prefecture?index>=0:names.includes(region.name);
   const group=document.createElementNS(SVG,'g');
   group.classList.add('map-region');group.dataset.name=region.name;
   if(available){group.classList.add('map-available');group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',`${region.name}を選ぶ`);const activate=()=>prefecture?(onSelect(index),refresh()):choosePrefecture(region.name);group.addEventListener('click',activate);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const wasPrefecture=Boolean(prefecture);activate();if(wasPrefecture){[...svg.querySelectorAll('[role=button]')].find(node=>node.dataset.name===region.name)?.focus();}else{$('prefecture-back').focus();}}});}
   if(prefecture?selected.name===region.name:selected.prefecture===region.name)group.classList.add('map-selected');
   for(const polygon of region.polygons){const node=document.createElementNS(SVG,'polygon');node.setAttribute('points',polygon.map(p=>p.join(',')).join(' '));group.append(node);}
   const title=document.createElementNS(SVG,'title');title.textContent=region.name;group.append(title);svg.append(group);
  }
 }
 function loadMap(){
  if(mapRequested||$('choose-region').hidden)return;
  mapRequested=true;
  fetch('./selection-map.json?v=20261105').then(response=>{if(!response.ok)throw Error('地図を読み込めませんでした');return response.json();}).then(data=>{maps=data;refresh();}).catch(error=>{console.warn('地域選択の背景地図を読み込めませんでした',error);mapFailed=true;refresh();});
 }
 function refresh(){
  loadMap();
  $('prefecture-list').hidden=Boolean(prefecture);$('prefecture-back').hidden=!prefecture;$('regions').hidden=!prefecture;
  $('picker-title').textContent=prefecture||'全国';$('picker-step').textContent=prefecture?'② 使う地域を選ぶ':'① 都道府県を選ぶ';
  $('map-caption').textContent=mapFailed?'地図を読み込めませんでした。左の一覧から選べます。':prefecture?'左の一覧から県全体や都市を選べます':'色のついた都道府県から選べます';
  document.querySelectorAll('.region-card').forEach(card=>{card.hidden=regions[Number(card.dataset.index)].prefecture!==prefecture;card.setAttribute('aria-pressed',String(Number(card.dataset.index)===getSelected()));});
  const selected=regions[getSelected()],stats=regionStats(selected),detail=$('selected-region-detail');detail.replaceChildren(element('small','選択中'),element('h3',selected.name));
  for(const [label,value] of [['攻撃力',50],['回転力',stats.spinPower],['底力',stats.grit]]){const row=element('div');row.className='picker-stat';row.append(element('span',label),element('b',String(value)));const meter=element('meter');meter.min=0;meter.max=100;meter.value=value;meter.setAttribute('aria-label',label);row.append(meter);detail.append(row);}
  drawMap();
 }
 refresh();return {refresh,reset:()=>choosePrefecture('')};
}
