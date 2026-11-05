import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,launch,step,criticalChance} from '../engine.mjs';
const square={points:[[-1,-1],[1,-1],[1,1],[-1,1]],grit:50,spinPower:50};
const fixture=(rng=1,energy=1)=>{
 const m=launch(createMatch(square,square,12),{x:0,y:-1},1);
 return {...m,criticalRng:rng,bodies:m.bodies.map((b,i)=>({...b,x:i?16:-16,y:0,vx:i?-100:100,vy:0,spin:0,cruiseSpin:0,energy,angle:0}))};
};
const lcg=n=>(Math.imul(n,1664525)+1013904223)>>>0;
const seedFor=bits=>{for(let n=0;n<100000;n++){const a=lcg(n),b=lcg(a);if((a/2**32<.08)===bits[0]&&(b/2**32<.08)===bits[1])return n;}throw Error('seed');};
test('critical chance has common baseline and quadratic grit comeback bounds',()=>{
 assert.equal(criticalChance({energy:1,grit:100}),.08);
 assert.equal(criticalChance({energy:0,grit:50}),.12);
 assert.equal(criticalChance({energy:0,grit:100}),.16);
 assert.equal(criticalChance({energy:.5,grit:100}),.10);
 assert.equal(criticalChance({energy:-1,grit:100}),.16);
 assert.equal(criticalChance({energy:0,grit:0}),.08);
});
test('critical rolls are deterministic immutable and amplify only the opposing damage',()=>{
 const ordinary=step(fixture(seedFor([false,false])),1/120);
 const input=fixture(seedFor([true,false])),before=structuredClone(input);
 const out=step(input,1/120);
 assert.deepEqual(input,before);assert.deepEqual(out,step(input,1/120));
 assert.deepEqual(out.impacts.at(-1).criticalAttackers,[0]);
 assert.equal(out.impacts.at(-1).critical,true);
 assert.equal(out.bodies[0].energy,ordinary.bodies[0].energy);
 const passive=1/120*.035*(1-.30*.5);
 assert.ok(Math.abs((1-passive-out.bodies[1].energy)/(1-passive-ordinary.bodies[1].energy)-1.5)<1e-8);
 assert.equal(out.criticalRng,lcg(lcg(input.criticalRng)));
});
test('both attacks can crit in one contact including final blow and retain negative raw energy',()=>{
 const out=step(fixture(seedFor([true,true]),.001),1/120);
 assert.deepEqual(out.impacts.at(-1).criticalAttackers,[0,1]);
 assert.equal(out.phase,'finished');
 assert.ok(out.bodies.every(b=>b.energy===0&&b.rawEnergy<0));
});
test('non-damaging contact does not consume rolls or contact eligibility',()=>{
 const m=fixture(1);const away={...m,bodies:m.bodies.map((b,i)=>({...b,vx:i?100:-100}))};
 const out=step(away,1/120);
 assert.ok(out.impacts.length);assert.equal(out.criticalRng,away.criticalRng);
 assert.equal(out.criticalContact.spent,false);
});
test('continued contact cannot reroll until a real separation interval',()=>{
 const first=step(fixture(seedFor([true,true])),1/120);
 const repeated={...fixture(first.criticalRng),criticalContact:first.criticalContact,impactSerial:first.impactSerial};
 const second=step(repeated,1/120);
 assert.equal(second.criticalRng,first.criticalRng);
 assert.deepEqual(second.impacts.at(-1).criticalAttackers,[]);
 assert.ok(second.impacts.at(-1).id>first.impacts.at(-1).id);
 let separated={...second,bodies:second.bodies.map((b,i)=>({...b,x:i?100:-100,y:0,vx:0,vy:0}))};
 separated=step(separated,.1); separated=step(separated,1/120);
 const next=step({...fixture(separated.criticalRng),criticalContact:separated.criticalContact},1/120);
 assert.notEqual(next.criticalRng,separated.criticalRng);
});
test('critical cap is 27 percent and simultaneous raw-energy comparison stays fair',()=>{
 const m=fixture(seedFor([true,true]));
 const hard={...m,bodies:m.bodies.map((b,i)=>({...b,vx:i?-340:340,
  spin:i?-24:24,cruiseSpin:i?-24:24,angle:.2}))};
 const out=step(hard,1/120),passive=1/120*.035*(1-.30*.5);
 assert.ok(out.bodies.every(b=>Math.abs(1-passive-b.rawEnergy-.27)<1e-8));
 const asymmetric={...fixture(seedFor([true,true]),.001),bodies:fixture(1,.001).bodies.map((b,i)=>({...b,energy:i?.002:.001}))};
 const final=step(asymmetric,1/120);
 assert.equal(final.phase,'finished');
 assert.ok(final.bodies.every(b=>b.energy===0));
 const expected=final.bodies[0].rawEnergy>final.bodies[1].rawEnergy?'player':'cpu';
 assert.equal(final.result.winner,expected);
 assert.equal(final.result.tiebreak,'remaining-energy');
});
test('short separation jitter cannot rearm the critical lottery',()=>{
 const first=step(fixture(seedFor([true,true])),1/120);
 const separated=step({...first,bodies:first.bodies.map((b,i)=>({...b,x:i?100:-100,y:0,vx:0,vy:0}))},1/120);
 const returned=step({...fixture(separated.criticalRng),criticalContact:separated.criticalContact},1/120);
 assert.equal(returned.criticalRng,separated.criticalRng);
 assert.deepEqual(returned.impacts.at(-1).criticalAttackers,[]);
});
