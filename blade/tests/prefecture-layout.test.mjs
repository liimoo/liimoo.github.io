import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prefectureLayout} from '../prefecture-layout.mjs';
const read=code=>JSON.parse(readFileSync(new URL(`../selection-maps/${code}.json`,import.meta.url)));
for(const code of ['13','32','42','46','47'])for(const compact of [false,true])test(`${code} ${compact?'portrait':'wide'} insets preserve all source polygons and fit their frames`,()=>{
 const source=read(code),copy=structuredClone(source),layout=prefectureLayout(source,code,{compact});
 assert.deepEqual(source,copy);assert.ok(layout);
 assert.deepEqual(layout.regions.map(r=>r.name),source.map(r=>r.name));
 layout.regions.forEach((region,i)=>{
  assert.deepEqual(region.polygons.map(p=>p.length),source[i].polygons.map(p=>p.length));
  assert.ok(region.labelPoint.every(Number.isFinite));
  region.polygons.forEach((polygon,j)=>{
   const frame=layout.frames.find(f=>f.id===(region.polygonFrameIds?.[j]||region.frameId));
   for(const [x,y] of polygon){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=frame.x&&x<=frame.x+frame.width&&y>=frame.y&&y<=frame.y+frame.height);}
  });
 });
});
test('unaffected prefectures keep original presentation',()=>{
 for(const code of ['01','15','17','27'])assert.equal(prefectureLayout(read(code),code),null);
});
test('municipalities spanning mainland and remote islands retain one selection and mainland anchor',()=>{
 const box=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w]];
 const source=[{name:'同じ市',polygons:[box(0,0,100),box(1000,1000,10)]},{name:'別の村',polygons:[box(1020,1000,10)]}];
 const result=prefectureLayout(source,'鹿児島県',{compact:true});
 assert.equal(result.regions.length,2);
 assert.equal(result.regions[0].frameId,'mainland');
 assert.deepEqual(result.regions[0].polygonFrameIds,['mainland','islands']);
 assert.ok(result.regions[0].labelPoint[1]<370);
});
test('invalid affected map coordinates fail clearly',()=>assert.throws(()=>prefectureLayout([{name:'市',polygons:[[[NaN,0],[0,1],[1,1]]]}],'32'),/Invalid/));
