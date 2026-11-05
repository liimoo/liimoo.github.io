import test from 'node:test';
import assert from 'node:assert/strict';
import {criticalPresentations} from '../critical-presentation.mjs';
const bodies=Array.from({length:6},(_,i)=>({side:i<3?'player':'cpu',region:{name:`都市${i}`}}));
test('team critical identifies the actual attacker and defender, not the whole opposite team',()=>{
 const hit={participants:[1,5],criticalAttackers:[5,1]};
 const before=JSON.stringify(hit);
 const events=criticalPresentations(hit,bodies);
 assert.deepEqual(events.map(e=>[e.attacker,e.defender,e.label,e.city]),[[5,1,'痛恨の一撃！','都市5'],[1,5,'会心の一撃！','都市1']]);
 assert.notEqual(events[0].color,events[1].color);assert.equal(JSON.stringify(hit),before);
});
test('solo compatibility and noncritical/friendly events are handled',()=>{
 const solo=[bodies[0],bodies[3]];
 assert.equal(criticalPresentations({criticalAttackers:[1]},solo)[0].defender,0);
 assert.deepEqual(criticalPresentations({},solo),[]);
 assert.deepEqual(criticalPresentations({participants:[0,1],criticalAttackers:[0]},bodies),[]);
});
