import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinishEffect,advanceFinishEffect,hiddenByFinish,finishBody,canExplode} from '../finish-effects.mjs';
const region={points:[[-1,-1],[1,-1],[1,1],[-1,1]]};
const bodies=[{region,side:'player',x:10,y:20,angle:1,spin:12,cruiseSpin:12,vx:0,vy:0},{region,side:'cpu',x:-20,y:30,angle:2,spin:-13,cruiseSpin:-13,vx:0,vy:0}];
const match=(winner='player',reason='spin')=>({bodies,result:{winner,reason}});
test('only the defeated map shatters and source state stays unchanged',()=>{
 const m=match(),copy=structuredClone(m),fx=createFinishEffect(m);
 assert.deepEqual(fx.losers,[1]);
 assert.deepEqual(createFinishEffect(match('cpu')).losers,[0]);
 assert.deepEqual(createFinishEffect(match('player','ringout')).losers,[1]);
 assert.deepEqual(m,copy);
 assert.equal(hiddenByFinish(fx,1),false);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.2),1),false);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.2),0),false);
});
test('simultaneous defeat breaks both maps but timeout breaks neither',()=>{
 assert.deepEqual(createFinishEffect(match('draw')).losers,[0,1]);
 assert.deepEqual(createFinishEffect(match('draw','ringout')).losers,[0,1]);
 assert.deepEqual(createFinishEffect(match('draw','time')).losers,[]);
});
test('result waits for finite effect duration with immutable progression',()=>{
 const fx=createFinishEffect(match());
 const next=advanceFinishEffect(fx,.5);
 assert.equal(fx.age,0);assert.equal(next.done,false);
 assert.equal(advanceFinishEffect(next,2).done,true);
 assert.equal(advanceFinishEffect(next,2).age,fx.duration);
 assert.deepEqual(advanceFinishEffect(fx,NaN),fx);
 assert.deepEqual(advanceFinishEffect(fx,-1),fx);
});
test('reduced motion uses a short fade with no shattered map replacement',()=>{
 const fx=createFinishEffect(match(),true);
 assert.ok(fx.duration<.5);assert.equal(fx.reduced,true);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.2),1),false);
 assert.equal(advanceFinishEffect(fx,.5).done,true);
});
test('effect rendering stays finite with balanced canvas state at every phase',async()=>{
 const {drawFinishEffect,finishShake}=await import('../finish-effects.mjs');
 const maps=bodies.map(b=>({...b,region:{points:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]}}));
 let depth=0,calls=0;
 const ctx=new Proxy({}, {
  set(target,key,value){
   if(key==='globalAlpha')assert.ok(value>=0&&value<=1);
   if(key==='lineWidth')assert.ok(value>0);
   target[key]=value;return true;
  },
  get(target,key){
   if(key==='createRadialGradient')return ()=>({addColorStop(){}});
   return (...args)=>{
    calls++;
    for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));
    if(key==='save')depth++;
    if(key==='restore')depth--;
    assert.ok(depth>=0);
    if(key==='arc')assert.ok(args[2]>=0);
   };
  }
 });
 assert.deepEqual(finishShake(null),{x:0,y:0});
 drawFinishEffect(ctx,null,maps);
 for(const reduced of [false,true])for(const age of [0,.05,.1,.4,.65,.68,.8,.95,1.7]) {
  const fx=advanceFinishEffect(createFinishEffect(match('draw'),reduced),age);
  drawFinishEffect(ctx,fx,maps);
  assert.equal(depth,0);
  const shake=finishShake(fx);
  assert.ok(Math.abs(shake.x)<=5&&Math.abs(shake.y)<=5);
  if(reduced)assert.deepEqual(shake,{x:0,y:0});
 }
 assert.ok(calls>0);
});

test('stamina defeat visibly slows, holds still, then explodes',()=>{
 const terminal={...match(),bodies:bodies.map(b=>({...b,spin:0}))};
 const fx=createFinishEffect(terminal,false,bodies);
 const at=t=>finishBody(advanceFinishEffect(fx,t),1,terminal.bodies[1]);
 const first=Math.abs(at(.1).angle-at(0).angle);
 const later=Math.abs(at(.4).angle-at(.3).angle);
 assert.ok(first>later && later>0);
 assert.equal(at(.45).angle,at(.6).angle);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.6),1),false);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,.7),1),true);
 assert.equal(advanceFinishEffect(fx,.7).done,false);
});
test('ringout flies outward and explodes only while visible',()=>{
 for(const x of [189,250]) {
  const m={...match('cpu','ringout'),bodies:[{...bodies[0],x,y:0,vx:100,vy:0},bodies[1]]};
  const fx=createFinishEffect(m);
  const flying=finishBody(advanceFinishEffect(fx,.2),0,m.bodies[0]);
  assert.ok(flying.x>x);
  assert.equal(hiddenByFinish(advanceFinishEffect(fx,.2),0),false);
  assert.equal(canExplode(fx,0),x===189);
  assert.equal(canExplode(fx,1),false);
  if(x===250)assert.ok(fx.duration<.6);
 }
});
test('survivor carries terminal velocity and rotation into a smooth victory glide',()=>{
 const survivor={...bodies[0],x:80,y:-30,vx:90,vy:-40,spin:11};
 const m={...match(),bodies:[survivor,bodies[1]]};
 const fx=createFinishEffect(m);
 const start=finishBody(fx,0,survivor),dt=.00001;
 const next=finishBody(advanceFinishEffect(fx,dt),0,survivor);
 assert.equal(start.x,survivor.x);assert.equal(start.y,survivor.y);
 assert.ok(Math.abs((next.x-start.x)/dt-survivor.vx)<.01);
 assert.ok(Math.abs((next.y-start.y)/dt-survivor.vy)<.01);
 assert.ok(Math.abs((next.angle-start.angle)/dt-survivor.spin)<.01);
 const settled=finishBody(advanceFinishEffect(fx,10),0,survivor);
 assert.ok(Math.abs(settled.x)<1 && Math.abs(settled.y-65)<1);
});
test('survivor keeps moving after result appears without changing terminal physics',()=>{
 const m=match(),snapshot=structuredClone(m),fx=createFinishEffect(m);
 const shown=advanceFinishEffect(fx,fx.duration);
 const later=advanceFinishEffect(shown,.3);
 assert.equal(shown.done,true);assert.equal(later.done,true);
 assert.equal(shown.age,later.age);
 assert.notEqual(finishBody(shown,0,m.bodies[0]).angle,finishBody(later,0,m.bodies[0]).angle);
 assert.deepEqual(m,snapshot);
});

test('timeout survivors settle separately and reduced motion stays still',()=>{
 const m=match('draw','time'),fx=advanceFinishEffect(createFinishEffect(m),10);
 const left=finishBody(fx,0,m.bodies[0]),right=finishBody(fx,1,m.bodies[1]);
 assert.ok(right.x-left.x>100);
 const reduced=advanceFinishEffect(createFinishEffect(match(),true),10);
 assert.deepEqual(finishBody(reduced,0,bodies[0]),bodies[0]);
});

test('survivor slows monotonically and stops rotating after four seconds',()=>{
 for(const spin of [-24,-8,0,8,24]){
  const body={...bodies[0],spin},m={...match(),bodies:[body,bodies[1]]};
  const fx=createFinishEffect(m),angle=t=>finishBody(advanceFinishEffect(fx,t),0,body).angle;
  let previous=Math.abs(spin)+.001;
  for(const t of [0,.5,1,2,3,3.9,4]){
   const speed=(angle(t+.00001)-angle(t))/.00001;
   assert.ok(Math.abs(speed)<=previous+.00001);
   assert.ok(speed*spin>=0);
   previous=Math.abs(speed);
  }
  assert.equal(angle(4),angle(180));
  assert.ok(Math.abs((angle(4)-angle(3.999))/.001)<.001);
 }
});

test('simultaneous depletion winner carries pre-impact spin without shattering',()=>{
 const m={bodies:bodies.map(b=>({...b,energy:0,spin:0})),result:{winner:'player',reason:'spin',tiebreak:'remaining-energy'}};
 const fx=createFinishEffect(m,false,bodies);
 assert.equal(fx.origins[0].spin,bodies[0].spin);
 assert.deepEqual(fx.losers,[1]);
 assert.equal(hiddenByFinish(advanceFinishEffect(fx,2),0),false);
});
