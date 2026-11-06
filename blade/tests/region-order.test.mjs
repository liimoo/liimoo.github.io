import test from 'node:test';
import assert from 'node:assert/strict';
import {orderRegions} from '../region-order.mjs';
const rows=[{region:{name:'南市',reading:'みなみし',sortY:80,kind:'市'},index:7},{region:{name:'北町',reading:'きたまち',sortY:10,kind:'市'},index:3},{region:{name:'県全体',reading:'けん',kind:'県'},index:9}];
test('city sorting uses map position and kana while keeping the prefecture pinned and ids stable',()=>{
 const before=JSON.stringify(rows);
 assert.deepEqual(orderRegions(rows,'north').map(r=>r.index),[9,3,7]);
 assert.deepEqual(orderRegions(rows,'south').map(r=>r.index),[9,7,3]);
 assert.deepEqual(orderRegions(rows,'kana').map(r=>r.index),[9,3,7]);
 assert.equal(JSON.stringify(rows),before);
});
test('national ordering follows prefecture codes or readings',()=>{
 const list=[{region:{prefectureCode:'47',reading:'おきなわ',name:'沖縄県',kind:'県'}},{region:{prefectureCode:'01',reading:'ほっかいどう',name:'北海道',kind:'県'}},{region:{prefectureCode:'23',reading:'あいち',name:'愛知県',kind:'県'}}];
 assert.deepEqual(orderRegions(list,'north').map(r=>r.region.prefectureCode),['01','23','47']);
 assert.deepEqual(orderRegions(list,'south').map(r=>r.region.prefectureCode),['47','23','01']);
 assert.deepEqual(orderRegions(list,'kana').map(r=>r.region.prefectureCode),['23','47','01']);
});
