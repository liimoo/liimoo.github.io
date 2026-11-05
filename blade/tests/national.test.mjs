import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMatch, hull, regionStats, combatBonuses, BODY_RADIUS} from '../engine.mjs';
const regions=JSON.parse(await readFile(new URL('../regions.json',import.meta.url),'utf8'));

test('national roster contains every prefecture and municipality with unique identities',()=>{
 assert.equal(regions.length,1794);
 assert.equal(new Set(regions.map(r=>r.id)).size,regions.length);
 assert.equal(regions.filter(r=>r.kind==='県').length,47);
 assert.equal(regions.filter(r=>r.kind!=='県').length,1747);
 assert.equal(new Set(regions.map(r=>r.prefecture)).size,47);
 for(const prefecture of regions.filter(r=>r.kind==='県'))
  assert.ok(regions.some(r=>r.kind!=='県'&&r.prefecture===prefecture.name),prefecture.name);
});

test('every national shape has finite bounded geometry and equal starting combat conditions',()=>{
 for(const region of regions){
  assert.ok(region.name&&region.reading&&region.prefecture,region.id);
  assert.ok(region.points.length>=3&&region.points.length<=70,region.id);
  assert.ok(region.points.flat().every(Number.isFinite),region.id);
  assert.ok(Math.max(...region.points.map(p=>Math.hypot(...p)))<=1.0001,region.id);
  assert.ok(hull(region.points).length>=3,region.id);
  assert.deepEqual(regionStats(region),{grit:50,spinPower:50},region.id);
  const body=createMatch(region,regions[0]).bodies[0];
  assert.equal(body.mass,1);assert.equal(body.radius,BODY_RADIUS);assert.equal(body.inertia,400);
  assert.ok(Math.abs(Math.max(...body.shape.map(p=>Math.hypot(p.x,p.y)))-BODY_RADIUS)<1e-8);
  assert.deepEqual(combatBonuses(body),{attack:1,resistance:1});
 }
});
