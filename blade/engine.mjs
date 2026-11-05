/** Small deterministic 2D prototype. All public state transitions return copies. */
export const ARENA_RADIUS = 180;
export const BODY_RADIUS = 32;
export const MATCH_SECONDS = 45;
const EPSILON = 1e-8;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

export function hull(points) {
 if (!Array.isArray(points)) throw new Error('Invalid polygon points');
 const list = points.map(p => ({ x: p.x ?? p[0], y: p.y ?? p[1] }));
 if (list.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid polygon coordinates');
 const sorted = list.sort((a,b) => a.x-b.x || a.y-b.y)
  .filter((p,i,a) => !i || p.x !== a[i-1].x || p.y !== a[i-1].y);
 const half = values => values.reduce((out,p) => {
  while (out.length>1 && cross(subtract(out.at(-1),out.at(-2)),subtract(p,out.at(-1)))<=EPSILON) out.pop();
  out.push(p); return out;
 },[]);
 if(sorted.length<3) return sorted;
 return [...half(sorted).slice(0,-1), ...half([...sorted].reverse()).slice(0,-1)];
}

function regionShape(region) {
 const polygon = hull(region.points);
 if(polygon.length<3) throw new Error('A polygon requires at least three non-collinear points');
 const maxRadius = Math.max(...polygon.map(p=>Math.hypot(p.x,p.y)));
 return polygon.map(p=>({x:p.x/maxRadius*BODY_RADIUS,y:p.y/maxRadius*BODY_RADIUS}));
}

export function regionStats(region) {
 const shape=regionShape(region);
 if(region.grit!==undefined) {
  if(!Number.isFinite(region.grit)||region.grit<0||region.grit>100) throw new Error('Invalid grit');
  return {grit:region.grit};
 }
 const shapeInertia=shape.reduce((sum,p)=>sum+dot(p,p),0)/shape.length*.6;
 return {grit:Math.round(clamp((shapeInertia-180)/(BODY_RADIUS**2*.6-180),0,1)*100)};
}

export function combatBonuses(body) {
 const bonus=1+body.grit/100*(1-clamp(body.energy,0,1))**2;
 return {attack:bonus,resistance:bonus};
}

function body(region, side) {
 const shape=regionShape(region),{grit}=regionStats(region);
 return { region, shape, side, mass:1, radius:BODY_RADIUS, inertia:400, grit,
  x:0, y:side==='player'?95:-95, vx:0, vy:0, angle:0, spin:0, energy:1 };
}

export function createMatch(playerRegion, cpuRegion, seed=1) {
 return { bodies:[body(playerRegion,'player'),body(cpuRegion,'cpu')], seed:Number(seed)>>>0,
  elapsed:0, phase:'ready', result:null, impacts:[] };
}

export function launch(match, direction, power) {
 if(match.phase!=='ready') return match;
 if(!Number.isFinite(direction.x)||!Number.isFinite(direction.y)) throw new Error('Invalid direction');
 if(!Number.isFinite(power)) throw new Error('Invalid power');
 const length=Math.hypot(direction.x,direction.y);
 const aim=length>EPSILON?{x:direction.x/length,y:direction.y/length}:{x:0,y:-1};
 const strength=clamp(power,0,1);
 const variation=((Math.imul(match.seed,1664525)+1013904223)>>>0)/4294967296;
 const cpuAngle=(variation-.5)*.42;
 return {...match,phase:'active',bodies:match.bodies.map((b,i)=>({...b,
  vx:i?Math.sin(cpuAngle)*190:aim.x*(80+strength*160),
  vy:i?Math.cos(cpuAngle)*190:aim.y*(80+strength*160),
  spin:i?-13:12+strength*3,cruiseSpin:i?-13:12+strength*3,energy:1}))};
}

function vertices(b) {
 const c=Math.cos(b.angle),s=Math.sin(b.angle);
 return b.shape.map(p=>({x:b.x+p.x*c-p.y*s,y:b.y+p.x*s+p.y*c}));
}

function collision(a,b) {
 if(Math.hypot(a.x-b.x,a.y-b.y)>a.radius+b.radius) return null;
 const av=vertices(a),bv=vertices(b);
 let depth=Infinity,normal=null;
 for(const polygon of [av,bv]) for(let i=0;i<polygon.length;i++) {
  const edge=subtract(polygon[(i+1)%polygon.length],polygon[i]);
  const size=Math.hypot(edge.x,edge.y);
  if(size<EPSILON) continue;
  const axis={x:-edge.y/size,y:edge.x/size};
  const ap=av.map(p=>dot(p,axis)),bp=bv.map(p=>dot(p,axis));
  const overlap=Math.min(Math.max(...ap),Math.max(...bp))-Math.max(Math.min(...ap),Math.min(...bp));
  if(overlap<=0) return null;
  if(overlap<depth) {depth=overlap;normal=axis;}
 }
 if(!normal) return null;
 if(dot(subtract(b,a),normal)<0) normal={x:-normal.x,y:-normal.y};
 const support=(vs,sign)=>{
  const far=Math.max(...vs.map(p=>dot(p,normal)*sign));
  const face=vs.filter(p=>Math.abs(dot(p,normal)*sign-far)<.1);
  return {x:face.reduce((sum,p)=>sum+p.x,0)/face.length,y:face.reduce((sum,p)=>sum+p.y,0)/face.length};
 };
 const pa=support(av,1),pb=support(bv,-1);
 return {normal,depth,point:{x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2}};
}

function sustainedSpin(body,spin,energy) {
 // Preserve launch direction through repeated impacts while stamina remains.
 // Collision torque still determines damage; the arcade floor prevents stalled shoving.
 if(energy<=0) return 0;
 const direction=Math.sign(body.cruiseSpin);
 return direction*clamp(spin*direction,8,24);
}

function resolve(a,b,hit) {
 const {normal:n,depth,point:p}=hit;
 const ra=subtract(p,a),rb=subtract(p,b);
 const relative={x:b.vx-b.spin*rb.y-a.vx+a.spin*ra.y,y:b.vy+b.spin*rb.x-a.vy-a.spin*ra.x};
 const along=dot(relative,n);
 const effective=2+cross(ra,n)**2/a.inertia+cross(rb,n)**2/b.inertia;
 const impulse=Math.max(0,-1.72*along/effective);
 const tangent={x:-n.y,y:n.x};
 const friction=clamp(-dot(relative,tangent)/(2+cross(ra,tangent)**2/a.inertia+cross(rb,tangent)**2/b.inertia),-impulse*.3,impulse*.3);
 const force={x:n.x*impulse+tangent.x*friction,y:n.y*impulse+tangent.y*friction};
 const correction=(depth+.05)/2;

 return [a,b].map((v,i)=>{
  const sign=i?1:-1,offset=i?rb:ra;
  const vx=v.vx+sign*force.x,vy=v.vy+sign*force.y;
  const speed=Math.hypot(vx,vy),scale=speed>340?340/speed:1;
  const {resistance}=combatBonuses(v),{attack}=combatBonuses(i?a:b);
  const angularChange=sign*cross(offset,force)/v.inertia/resistance;
  // Grit resists torque and boosts stamina damage, never the linear collision impulse.
  const drain=Math.min(.18,(impulse*.00012+Math.abs(angularChange)*.012)*attack);
  const energy=Math.max(0,v.energy-drain);
  return {...v,x:v.x+sign*n.x*correction,y:v.y+sign*n.y*correction,
   vx:vx*scale,vy:vy*scale,
   spin:sustainedSpin(v,v.spin+angularChange,energy),energy};
 });
}

function move(b,dt) {
 // Arcade bowl: stamina is endurance, not a multiplier on visible rotation.
 const energy=Math.max(0,b.energy-dt*.035);
 const recovery=1-Math.exp(-4*dt);
 const spin=sustainedSpin(b,b.spin+(b.cruiseSpin-b.spin)*recovery,energy);
 const bowl=2.8,damping=Math.exp(-.13*dt);
 const vx=(b.vx-b.x*bowl*dt)*damping,vy=(b.vy-b.y*bowl*dt)*damping;
 const speed=Math.hypot(vx,vy);
 // Smooth low-speed assistance keeps collisions from leaving inert tops together.
 // No teleport, wall bounce or boost to already fast launches.
 const assist=energy>0?Math.max(0,40-speed)*(1-Math.exp(-2*dt)):0;
 const distance=Math.hypot(b.x,b.y);
 const dx=speed>EPSILON?vx/speed:distance>EPSILON?-b.x/distance:1;
 const dy=speed>EPSILON?vy/speed:distance>EPSILON?-b.y/distance:0;
 const nextX=vx+dx*assist,nextY=vy+dy*assist;
 const limit=Math.min(1,340/Math.max(EPSILON,Math.hypot(nextX,nextY)));
 return {...b,vx:nextX*limit,vy:nextY*limit,
  x:b.x+nextX*limit*dt,y:b.y+nextY*limit*dt,
  angle:(b.angle+spin*dt)%(Math.PI*2),spin,energy};
}

function outcome(bodies,elapsed) {
 const outside=bodies.map(b=>Math.hypot(b.x,b.y)>ARENA_RADIUS+8);
 const exhausted=bodies.map(b=>b.energy<=0);
 const loser=outside.some(Boolean)?outside:exhausted;
 if(loser.some(Boolean)) return {winner:loser[0]&&loser[1]?'draw':loser[0]?'cpu':'player',reason:outside.some(Boolean)?'ringout':'spin'};
 return elapsed>=MATCH_SECONDS?{winner:'draw',reason:'time'}:null;
}

export function step(match,dt) {
 if(match.phase!=='active'||!Number.isFinite(dt)||dt<=0) return match;
 // Substeps prevent a delayed frame from tunneling through narrow shapes.
 const duration=Math.min(dt,.1),count=Math.ceil(duration/(1/120)),slice=duration/count;
 let current=match;
 for(let i=0;i<count;i++) {
  let bodies=current.bodies.map(b=>move(b,slice));
  let impacts=current.impacts.map(p=>({...p,age:p.age+slice})).filter(p=>p.age<.45);
  const hit=collision(...bodies);
  if(hit) {bodies=resolve(...bodies,hit);impacts=[...impacts.slice(-11),{...hit.point,age:0}];}
  const elapsed=current.elapsed+slice,result=outcome(bodies,elapsed);
  current={...current,bodies,impacts,elapsed,result,phase:result?'finished':'active'};
  if(result) break;
 }
 return current;
}
