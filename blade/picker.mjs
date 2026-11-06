import {prefectureLayout} from './prefecture-layout.mjs?v=20261106-insets';
import {drawFrames,drawSelectionLabels} from './map-annotations.mjs?v=20261106-insets';
import {orderRegions} from './region-order.mjs?v=20261106-sort';
const $=id=>document.getElementById(id),SVG='http://www.w3.org/2000/svg';
const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase();
function validMapRegions(items,{national=false}={}){
 return Array.isArray(items)&&items.length>0&&items.every(region=>
  region&&typeof region.name==='string'&&region.name.length>0&&
  (!national||/^\d{2}$/.test(String(region.code)))&&
  Array.isArray(region.polygons)&&region.polygons.length>0&&region.polygons.every(polygon=>
   Array.isArray(polygon)&&polygon.length>=3&&polygon.every(point=>
    Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))));
}
function mapBounds(source){
 const points=source.flatMap(region=>region.polygons.flat());
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const [x,y] of points){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 const w=maxX-minX,h=maxY-minY,pad=Math.max(w,h)*.04;
 return [minX-pad,minY-pad,w+pad*2,h+pad*2];
}
export function mountPicker({regions,getSelected,onSelect,getSelectedIndices=()=>[getSelected()],isTeam=()=>false}){
 let order='north';
 let prefecture='',maps=null,mapRequested=false,mapFailed=false,renderedPrefecture=null;
 const cityMaps=new Map(),pending=new Set(),failed=new Set();
 let cameraFrame=0,cameraActive=false,cameraReveal=null;
 function cancelCamera(){
  cancelAnimationFrame(cameraFrame);cameraReveal?.cancel();cameraReveal=null;cameraActive=false;
  const svg=$('selection-map');svg.removeAttribute('aria-busy');svg.style.pointerEvents='';svg.removeAttribute('inert');
 }
 function zoomCamera(from,to,onDone){
  const svg=$('selection-map');cameraActive=true;svg.setAttribute('aria-busy','true');svg.setAttribute('inert','');svg.style.pointerEvents='none';
  const started=performance.now();
  const frame=now=>{
   const t=Math.min(1,(now-started)/420),ease=t*t*(3-2*t);
   svg.setAttribute('viewBox',from.map((value,i)=>value+(to[i]-value)*ease).join(' '));
   if(t<1)cameraFrame=requestAnimationFrame(frame);else{cancelCamera();onDone();}
  };
  svg.setAttribute('viewBox',from.join(' '));cameraFrame=requestAnimationFrame(frame);
 }
 const names=[...new Set(regions.map(r=>r.prefecture))].sort((a,b)=>Number(regions.find(r=>r.prefecture===a).prefectureCode)-Number(regions.find(r=>r.prefecture===b).prefectureCode));
 const byPrefecture=new Map(names.map(name=>[name,regions.map((region,index)=>({region,index})).filter(item=>item.region.prefecture===name)]));
 function choosePrefecture(name){
  const interrupted=cameraActive?$('selection-map').getAttribute('viewBox').split(' ').map(Number):null;
  const previous=prefecture;cancelCamera();drawMap();
  const national=maps?.prefectures,focus=national?.find(region=>region.name===(name||previous));
  const animate=previous!==name&&(!previous||!name)&&focus&&!$('choose-region').hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const from=interrupted||(name?national&&mapBounds(national):focus&&mapBounds([focus]));
  const to=name?focus&&mapBounds([focus]):national&&mapBounds(national);
  prefecture=name;$('region-search').value='';
  // Keep the national geometry while the camera moves; async refreshes may
  // update cards and loading messages, but must not replace the moving map.
  if(animate&&name)cameraActive=true;
  refresh();document.querySelector('.picker-sidebar').scrollTop=0;
  if(animate)zoomCamera(from,to,()=>{drawMap();if(name)cameraReveal=$('selection-map').animate([{opacity:.35},{opacity:1}],{duration:120});});
 }
 for(const name of names){
  const button=element('button');button.type='button';button.className='prefecture-card';button.dataset.prefecture=name;
  button.append(element('small',regions.find(r=>r.name===name)?.reading||'都道府県'),element('strong',`${name} ›`));
  button.addEventListener('click',()=>choosePrefecture(name));$('prefecture-list').append(button);
 }
 function sortPrefectures(){
  const items=names.map(name=>({region:regions.find(r=>r.name===name&&r.kind==='県')}));
  const cards=new Map([...$('prefecture-list').children].map(card=>[card.dataset.prefecture,card]));
  for(const {region} of orderRegions(items,order))$('prefecture-list').append(cards.get(region.name));
 }
 $('region-order').addEventListener('change',()=>{
  order=$('region-order').value;sortPrefectures();refresh();document.querySelector('.picker-sidebar').scrollTop=0;
 });
 sortPrefectures();
 $('prefecture-back').addEventListener('click',()=>choosePrefecture(''));
 function renderCards(){
  const renderKey=`${prefecture}:${isTeam()}:${order}`;
  if(renderedPrefecture===renderKey)return;
  renderedPrefecture=renderKey;
  const fragment=document.createDocumentFragment();
  for(const {region,index} of orderRegions(byPrefecture.get(prefecture)||[],order)){
   if(isTeam()&&region.name===region.prefecture)continue;
   const button=element('button');button.type='button';button.className='region-card';button.dataset.index=String(index);
   button.setAttribute('aria-label',`${region.name}を選ぶ`);
   button.append(element('small',region.reading),element('strong',region.name),element('small',region.name===prefecture?'県全体':'市区町村'));
   button.addEventListener('click',()=>selectRegion(index));fragment.append(button);
  }
  $('regions').replaceChildren(fragment);
 }
 function filterCards(){
  const query=normalize($('region-search').value);let count=0;
  for(const card of $('regions').children){const region=regions[Number(card.dataset.index)];card.hidden=!normalize(`${region.name} ${region.reading}`).includes(query);card.setAttribute('aria-pressed',String(getSelectedIndices().includes(Number(card.dataset.index))));if(!card.hidden)count++;}
  $('no-regions').hidden=!prefecture||count>0;
 }
 $('region-search').addEventListener('input',filterCards);
 function selectRegion(index){
  onSelect(index);refresh();
  if(!getSelectedIndices().includes(index)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(const group of $('selection-map').querySelectorAll('.map-selected'))if(regions[index].name===prefecture||group.dataset.name===regions[index].name)group.animate([{opacity:.35},{opacity:1}],{duration:450});
 }
 function activateMap(name,index){if(cameraActive)return;if(prefecture)selectRegion(index);else choosePrefecture(name);}
 function drawMap(){
  if(cameraActive)return;
  const svg=$('selection-map');svg.replaceChildren();
  const selected=regions[getSelected()];
  const source=prefecture?cityMaps.get(prefecture):maps?.prefectures;
  if(!source?.length){
   const fallback=regions.find(r=>r.name===prefecture)||selected;
   if(!fallback){svg.setAttribute('viewBox','0 0 1 1');return;}
   const polygon=document.createElementNS(SVG,'polygon');polygon.setAttribute('points',fallback.points.map(p=>p.join(',')).join(' '));polygon.classList.add('map-selected');svg.append(polygon);svg.setAttribute('viewBox','-1.2 -1.2 2.4 2.4');return;
  }
  const layout=prefecture?prefectureLayout(source,prefecture,{compact:svg.clientWidth<500}):null;
  const display=layout?.regions??source,bounds=layout?.bounds??mapBounds(source);
  svg.setAttribute('viewBox',bounds.join(' '));
  if(layout)drawFrames(svg,layout.frames);
  const entries=byPrefecture.get(prefecture)||[];
  for(const region of display){
   const index=entries.find(item=>item.region.name===region.name)?.index??-1;
   const available=prefecture?index>=0:names.includes(region.name);
   const group=document.createElementNS(SVG,'g');group.classList.add('map-region');group.dataset.name=region.name;
   if(available){
    group.classList.add('map-available');group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',`${region.name}を選ぶ`);
    group.addEventListener('click',()=>activateMap(region.name,index));
    group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();const wasPrefecture=Boolean(prefecture);activateMap(region.name,index);if(wasPrefecture){[...svg.querySelectorAll('[role=button]')].find(node=>node.dataset.name===region.name)?.focus();}else $('prefecture-back').focus();}});
   }
   if(getSelectedIndices().some(i=>prefecture?regions[i].prefecture===prefecture&&(regions[i].name===prefecture||regions[i].name===region.name):regions[i].prefecture===region.name))group.classList.add('map-selected');
   for(const polygon of region.polygons){const node=document.createElementNS(SVG,'polygon');node.setAttribute('points',polygon.map(p=>p.join(',')).join(' '));group.append(node);}
   const title=document.createElementNS(SVG,'title');title.textContent=region.name;group.append(title);svg.append(group);
  }
  if(prefecture)drawSelectionLabels(svg,display,getSelectedIndices().map(i=>regions[i]?.name),bounds,layout?.frames);
  if(layout&&prefecture==='東京都'){for(const region of display.filter(r=>r.frameId!=='mainland'&&!getSelectedIndices().some(i=>regions[i]?.name===r.name))){const label=document.createElementNS(SVG,'text');label.setAttribute('x',(region.namePoint??region.labelPoint)[0]);label.setAttribute('y',(region.namePoint??region.labelPoint)[1]);label.setAttribute('class','map-island-name');label.setAttribute('font-size',bounds[2]===600?'24':'18');label.textContent=region.name;svg.append(label);}}
 }
 async function loadCityMap(name){
  if(!name||cityMaps.has(name)||pending.has(name)||failed.has(name)||!maps)return;
  const code=maps.prefectures.find(region=>region.name===name)?.code;
  if(!/^\d{2}$/.test(String(code)))return;
  pending.add(name);
  try{const response=await fetch(`./selection-maps/${code}.json?v=20261106-detail`);if(!response.ok)throw Error('県の地図を読み込めませんでした');const data=await response.json();if(!validMapRegions(data))throw Error('県の地図形式が不正です');cityMaps.set(name,data);}
  catch(error){failed.add(name);console.warn('地域選択の地図を読み込めませんでした',error);}
  finally{pending.delete(name);if(prefecture===name)refresh();}
 }
 function loadMap(){
  if(mapRequested||$('choose-region').hidden)return;
  mapRequested=true;
  fetch('./selection-map.json?v=20261105-national').then(response=>{if(!response.ok)throw Error('地図を読み込めませんでした');return response.json();}).then(data=>{if(!validMapRegions(data?.prefectures,{national:true}))throw Error('全国の地図形式が不正です');maps=data;refresh();}).catch(error=>{console.warn('地域選択の地図を読み込めませんでした',error);mapFailed=true;refresh();});
 }
 function refresh(){
  loadMap();loadCityMap(prefecture);renderCards();filterCards();
  $('prefecture-list').hidden=Boolean(prefecture);$('prefecture-back').hidden=!prefecture;$('regions').hidden=!prefecture;$('region-search-label').hidden=!prefecture;
  $('picker-title').textContent=prefecture||'全国';$('picker-step').textContent=prefecture?'② 使う地域を選ぶ':'① 都道府県を選ぶ';
  $('map-caption').textContent=mapFailed||failed.has(prefecture)?'地図を読み込めませんでした。左の一覧から選べます。':pending.has(prefecture)?'県の地図を読み込み中… 左の一覧からも選べます。':prefecture?(isTeam()?'同じ県から3都市を選択。選択済みを押すと外せます':'左の一覧から県全体や都市を選べます'):'都道府県を選ぶと都市の地図が開きます';
  if(['東京都','島根県','長崎県','鹿児島県','沖縄県'].includes(prefecture)&&cityMaps.has(prefecture))$('map-caption').textContent='離島は位置・縮尺を変えて別枠に表示しています。';
  const selected=regions[getSelected()];$('selected-region-detail').replaceChildren(element('small',selected?'選択中':'選択状態'),element('h3',selected?.name||'未選択'),element('p',selected?'能力は全地域共通。地図の形で勝負！':'都道府県を選んで、使う地域を決めよう。'));
  drawMap();
 }
 new ResizeObserver(()=>{if(prefecture&&!cameraActive)drawMap();}).observe($('selection-map'));
 refresh();return {refresh,reset:()=>{cancelCamera();prefecture='';$('region-search').value='';refresh();document.querySelector('.picker-sidebar').scrollTop=0;}};
}
