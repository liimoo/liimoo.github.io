import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tokyoLayout} from '../tokyo-layout.mjs';
const source=JSON.parse(readFileSync(new URL('../selection-maps/13.json',import.meta.url)));
const islandNames=new Set(['大島町','利島村','新島村','神津島村','三宅村','御蔵島村','八丈町','青ヶ島村','小笠原村']);
test('Tokyo layout preserves source, names, polygon and vertex coverage',()=>{
 const original=structuredClone(source),result=tokyoLayout(source);
 assert.deepEqual(source,original);
 assert.deepEqual(result.bounds,[0,0,1000,800]);
 assert.deepEqual(result.regions.map(r=>r.name),source.map(r=>r.name));
 result.regions.forEach((r,i)=>{
  assert.notEqual(r,source[i]);
  assert.deepEqual(r.polygons.map(p=>p.length),source[i].polygons.map(p=>p.length));
  assert.ok(r.labelPoint.every(Number.isFinite));
  const frame=result.frames.find(f=>f.id===r.frameId);
  for(const [x,y] of [...r.polygons.flat(),r.labelPoint]){
   assert.ok(Number.isFinite(x)&&Number.isFinite(y));
   assert.ok(x>=frame.x&&x<=frame.x+frame.width);
   assert.ok(y>=frame.y&&y<=frame.y+frame.height);
  }
 });
});
test('mainland is enlarged and each island municipality has a readable contour',()=>{
 const {regions,frames}=tokyoLayout(source);
 assert.deepEqual(frames.map(f=>f.label),['本土','伊豆諸島','小笠原諸島']);
 const points=regions.filter(r=>!islandNames.has(r.name)).flatMap(r=>r.polygons.flat());
 assert.ok(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))>700);
 for(const region of regions.filter(r=>islandNames.has(r.name))){
  const sizes=region.polygons.map(p=>{
   const w=Math.max(...p.map(v=>v[0]))-Math.min(...p.map(v=>v[0]));
   const h=Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]));
   return Math.max(w,h);
  });
  assert.ok(Math.max(...sizes)>=55,region.name);
 }
});
test('empty map is supported and invalid coordinates are rejected',()=>{
 assert.deepEqual(tokyoLayout([]).regions,[]);
 assert.throws(()=>tokyoLayout([{name:'大島町',polygons:[[[NaN,0],[1,2],[2,3]]]}]),/Invalid/);
});

test('compact layout fills portrait space and keeps island labels below their shapes',()=>{
 const original=structuredClone(source),{regions,frames,bounds}=tokyoLayout(source,{compact:true});
 assert.deepEqual(bounds,[0,0,600,960]);
 assert.deepEqual(frames.map(({x,y,width,height})=>[x,y,width,height]),[[0,0,600,300],[0,320,600,380],[0,720,600,240]]);
 assert.deepEqual(source,original);
 assert.deepEqual(regions.map(r=>r.name),source.map(r=>r.name));
 regions.forEach((r,i)=>{
  assert.deepEqual(r.polygons.map(p=>p.length),source[i].polygons.map(p=>p.length));
  const f=frames.find(f=>f.id===r.frameId);
  for(const [x,y] of [...r.polygons.flat(),r.labelPoint]){
   assert.ok(Number.isFinite(x)&&Number.isFinite(y));
   assert.ok(x>=f.x&&x<=f.x+f.width&&y>=f.y&&y<=f.y+f.height);
  }
  if(islandNames.has(r.name)){
   assert.ok(r.namePoint[1]>Math.max(...r.polygons.flat().map(p=>p[1])));
   assert.ok(r.labelPoint[1]<r.namePoint[1]);
   const area=p=>Math.abs(p.reduce((sum,v,j)=>{const q=p[(j+1)%p.length];return sum+v[0]*q[1]-q[0]*v[1];},0))/2;
   const primary=source[i].polygons.reduce((best,p,j)=>area(p)>area(source[i].polygons[best])?j:best,0);
   const polygon=r.polygons[primary];
   assert.deepEqual(r.labelPoint,[0,1].map(axis=>(Math.min(...polygon.map(p=>p[axis]))+Math.max(...polygon.map(p=>p[axis])))/2));
  }
 });
 const oga=regions.find(r=>r.name==='小笠原村');
 const occupiedCells=new Set(oga.polygons.map(p=>Math.floor((Math.min(...p.map(v=>v[0]))-16)/142)));
 assert.equal(occupiedCells.size,4);
 const mainland=regions.filter(r=>r.frameId==='mainland').flatMap(r=>r.polygons.flat());
 assert.ok(Math.max(...mainland.map(p=>p[0]))-Math.min(...mainland.map(p=>p[0]))>500);
});

test('Ogasawara satellite contours stay beside their principal islands',()=>{
 const box=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w]];
 const source=[{name:'小笠原村',polygons:[box(0,0,10),box(100,0,9),box(200,0,8),box(300,0,7),box(12,0,1)]}];
 const {regions}=tokyoLayout(source,{compact:true});
 assert.equal(regions[0].polygons.length,5);
 const xs=regions[0].polygons.map(p=>Math.min(...p.map(v=>v[0])));
 assert.ok(xs[4]>xs[0]&&xs[4]<xs[1]);
});

test('distant small islands cannot shrink the main Ogasawara contour into invisibility',()=>{
 const box=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w]];
 const polygons=[box(0,0,10),box(12,0,9),box(23,0,8),box(33,0,7),box(1000,0,1),box(0,1000,1),box(-1000,0,1)];
 for(const compact of [false,true]){
  const {regions}=tokyoLayout([{name:'小笠原村',polygons}],{compact});
  const p=regions[0].polygons[0];
  const visibleArea=Math.abs(p.reduce((sum,v,i)=>{const q=p[(i+1)%p.length];return sum+v[0]*q[1]-q[0]*v[1];},0))/2;
  assert.ok(visibleArea>500,`main contour area ${visibleArea}`);
  assert.deepEqual(regions[0].polygons.map(p=>p.length),polygons.map(p=>p.length));
 }
});
