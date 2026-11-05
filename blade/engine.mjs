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

function statOverride(region,key,fallback) {
 if(region[key]===undefined) return fallback;
 if(!Number.isFinite(region[key])||region[key]<0||region[key]>100) throw new Error(`Invalid ${key}`);
 return region[key];
}

export function regionStats(region) {
 const shape=regionShape(region);
 const shapeInertia=shape.reduce((sum,p)=>sum+dot(p,p),0)/shape.length*.6;
 const area=Math.abs(shape.reduce((sum,p,i)=>sum+cross(p,shape[(i+1)%shape.length]),0))/2;
 const perimeter=shape.reduce((sum,p,i)=>sum+Math.hypot(p.x-shape[(i+1)%shape.length].x,p.y-shape[(i+1)%shape.length].y),0);
 return {
  grit:statOverride(region,'grit',Math.round(clamp((shapeInertia-180)/(BODY_RADIUS**2*.6-180),0,1)*100)),
  spinPower:statOverride(region,'spinPower',Math.round(clamp(4*Math.PI*area/perimeter**2,0,1)*100))
 };
}

export function combatBonuses(body) {
 const bonus=1+body.grit/100*(1-clamp(body.energy,0,1))**2;
 return {attack:bonus,resistance:bonus};
}

export function criticalChance(body) {
 return .08+.08*clamp(body.grit,0,100)/100*(1-clamp(body.energy,0,1))**2;
}
const nextCriticalRandom = seed => (Math.imul(seed,1664525)+1013904223)>>>0;

function body(region, side) {
 const shape=regionShape(region),{grit,spinPower}=regionStats(region);
 return { region, shape, side, mass:1, radius:BODY_RADIUS, inertia:400, grit, spinPower,
  x:0, y:side==='player'?95:-95, vx:0, vy:0, angle:0, spin:0, energy:1 };
}

export function createMatch(playerRegion, cpuRegion, seed=1) {
 return { bodies:[body(playerRegion,'player'),body(cpuRegion,'cpu')], seed:Number(seed)>>>0,
  elapsed:0, phase:'ready', result:null, impacts:[],
  criticalRng:(Number(seed)^0x9e3779b9)>>>0, criticalContact:{spent:false,separation:0}, impactSerial:0 };
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
 return {...match,phase:'active',bodies:match.bodies.map((b,i)=>{
  const cpu=match.mode==='team'?b.side==='cpu':Boolean(i);
  return {...b,vx:cpu?Math.sin(cpuAngle)*190:aim.x*(80+strength*160),
   vy:cpu?Math.cos(cpuAngle)*190:aim.y*(80+strength*160),
   spin:cpu?-13:12+strength*3,cruiseSpin:cpu?-13:12+strength*3,energy:1};
 })};
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

function resolve(a,b,hit,criticalAttackers=[]) {
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
  const multiplier=criticalAttackers.includes(i?0:1)?1.5:1;
  const drain=Math.min(.18,(impulse*.00012+Math.abs(angularChange)*.012)*attack)*multiplier;
  const rawEnergy=(v.rawEnergy??v.energy)-drain;
  const energy=Math.max(0,rawEnergy);
  return {...v,x:v.x+sign*n.x*correction,y:v.y+sign*n.y*correction,
   vx:vx*scale,vy:vy*scale,
   spin:sustainedSpin(v,v.spin+angularChange,energy),energy,rawEnergy};
 });
}

function move(b,dt) {
 // Arcade bowl: stamina is endurance, not a multiplier on visible rotation.
 const rawEnergy=b.energy-dt*.035*(1-.30*b.spinPower/100);
 const energy=Math.max(0,rawEnergy);
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
  angle:(b.angle+spin*dt)%(Math.PI*2),spin,energy,rawEnergy};
}

function outcome(bodies,elapsed) {
 const outside=bodies.map(b=>Math.hypot(b.x,b.y)>ARENA_RADIUS+8);
 const exhausted=bodies.map(b=>b.energy<=0);
 // Preserve ringout priority; compare overkill only when both gauges are exhausted.
 if(!outside.some(Boolean)&&exhausted.every(Boolean)) {
  const difference=(bodies[0].rawEnergy??bodies[0].energy)-(bodies[1].rawEnergy??bodies[1].energy);
  if(Math.abs(difference)>EPSILON)
   return {winner:difference>0?'player':'cpu',reason:'spin',tiebreak:'remaining-energy'};
 }
 const loser=outside.some(Boolean)?outside:exhausted;
 if(loser.some(Boolean)) return {winner:loser[0]&&loser[1]?'draw':loser[0]?'cpu':'player',reason:outside.some(Boolean)?'ringout':'spin'};
 return elapsed>=MATCH_SECONDS?{winner:'draw',reason:'time'}:null;
}

// One lottery per damaging contact episode, not one lottery per physics frame.
// At least 100 ms without contact rearms it, ignoring tiny SAT separation jitter.
function criticalCollision(current,bodies,hit,slice) {
 const contact=current.criticalContact??{spent:false,separation:0};
 let rng=current.criticalRng??((current.seed^0x9e3779b9)>>>0);
 if(!hit) {
  const separation=contact.separation+slice;
  return {bodies,rng,contact:{spent:separation>=.1-EPSILON?false:contact.spent,separation},attackers:[]};
 }
 const ordinary=resolve(...bodies,hit),attackers=[];
 let spent=contact.spent;
 if(!spent) for(let attacker=0;attacker<2;attacker++) {
  const defender=1-attacker;
  const damage=(bodies[defender].rawEnergy??bodies[defender].energy)-ordinary[defender].rawEnergy;
  if(damage<=EPSILON) continue;
  spent=true;rng=nextCriticalRandom(rng);
  if(rng/4294967296<criticalChance(bodies[attacker])) attackers.push(attacker);
 }
 return {bodies:attackers.length?resolve(...bodies,hit,attackers):ordinary,rng,
  contact:{spent,separation:0},attackers};
}

export function step(match,dt) {
 if(match.mode==='team') return stepTeam(match,dt);
 if(match.phase!=='active'||!Number.isFinite(dt)||dt<=0) return match;
 // Substeps prevent a delayed frame from tunneling through narrow shapes.
 const duration=Math.min(dt,.1),count=Math.ceil(duration/(1/120)),slice=duration/count;
 let current=match;
 for(let i=0;i<count;i++) {
  let bodies=current.bodies.map(b=>move(b,slice));
  let impacts=current.impacts.map(p=>({...p,age:p.age+slice})).filter(p=>p.age<.45);
  const hit=collision(...bodies);
  const critical=criticalCollision(current,bodies,hit,slice);
  bodies=critical.bodies;
  const impactSerial=(current.impactSerial??0)+(hit?1:0);
  if(hit) impacts=[...impacts.slice(-11),{...hit.point,age:0,id:impactSerial,
   critical:critical.attackers.length>0,criticalAttackers:critical.attackers}];
  const elapsed=current.elapsed+slice,result=outcome(bodies,elapsed);
  current={...current,bodies,impacts,elapsed,result,phase:result?'finished':'active',
   criticalRng:critical.rng,criticalContact:critical.contact,impactSerial};
  if(result) break;
 }
 return current;
}


function validateTeam(regions) {
 if(!Array.isArray(regions)||regions.length!==3) throw new Error('A team requires three cities');
 const prefecture=regions[0]?.prefectureCode??regions[0]?.prefecture;
 if(!prefecture||regions.some(r=>!r||r.kind!=='市'||!r.id||(r.prefectureCode??r.prefecture)!==prefecture))
  throw new Error('Choose three municipalities from the same prefecture');
 if(new Set(regions.map(r=>r.id)).size!==3) throw new Error('Choose three distinct municipalities');
}

export function createTeamMatch(playerRegions,cpuRegions,seed=1) {
 validateTeam(playerRegions);validateTeam(cpuRegions);
 const base=createMatch(playerRegions[0],cpuRegions[0],seed);
 const bodies=[...playerRegions,...cpuRegions].map((region,i)=>({...body(region,i<3?'player':'cpu'),
  x:(i%3-1)*72,y:i<3?95:-95,eliminated:false}));
 return {...base,mode:'team',bodies,criticalContacts:{},eliminations:[],eliminationSerial:0};
}

function teamResult(bodies,elapsed,events) {
 const alive=['player','cpu'].map(side=>bodies.filter(b=>b.side===side&&!b.eliminated));
 if(alive.every(team=>team.length===0)) {
  const last=events;
  const spinOnly=last.length>0&&last.every(e=>e.reason==='spin');
  const energies=['player','cpu'].map(side=>last.filter(e=>e.body.side===side)
   .reduce((sum,e)=>sum+(e.body.rawEnergy??e.body.energy),0));
  const difference=energies[0]-energies[1];
  return {winner:spinOnly&&Math.abs(difference)>EPSILON?(difference>0?'player':'cpu'):'draw',
   reason:spinOnly?'spin':'ringout',...(spinOnly&&Math.abs(difference)>EPSILON?{tiebreak:'remaining-energy'}:{})};
 }
 if(alive.some(team=>team.length===0)) return {winner:alive[0].length?'player':'cpu',reason:events.some(e=>e.reason==='ringout')?'ringout':'spin'};
 if(elapsed<MATCH_SECONDS) return null;
 const countDifference=alive[0].length-alive[1].length;
 const energyDifference=alive[0].reduce((sum,b)=>sum+b.energy,0)-alive[1].reduce((sum,b)=>sum+b.energy,0);
 const difference=countDifference||energyDifference;
 return {winner:Math.abs(difference)<EPSILON?'draw':difference>0?'player':'cpu',reason:'time'};
}

function teamCollisions(current,moved,slice) {
 let bodies=moved,rng=current.criticalRng,contacts={...current.criticalContacts},serial=current.impactSerial;
 let impacts=current.impacts.map(p=>({...p,age:p.age+slice})).filter(p=>p.age<.45);
 for(let a=0;a<bodies.length;a++) for(let b=a+1;b<bodies.length;b++) {
  const pair=[bodies[a],bodies[b]];
  if(pair.some(v=>v.eliminated||v.energy<=0||Math.hypot(v.x,v.y)>ARENA_RADIUS+8)) continue;
  const hit=collision(...pair),key=`${a}:${b}`,friendly=pair[0].side===pair[1].side;
  if(friendly&&!hit) continue;
  const critical=friendly?{bodies:resolve(...pair,hit).map((v,i)=>({...v,energy:pair[i].energy,
   rawEnergy:pair[i].rawEnergy,spin:sustainedSpin(pair[i],v.spin,pair[i].energy)})),rng,attackers:[]}
   :criticalCollision({...current,criticalRng:rng,criticalContact:contacts[key]},pair,hit,slice);
  rng=critical.rng;if(!friendly) contacts={...contacts,[key]:critical.contact};
  bodies=bodies.map((v,i)=>i===a?critical.bodies[0]:i===b?critical.bodies[1]:v);
  if(hit) impacts=[...impacts.slice(-31),{...hit.point,age:0,id:++serial,critical:critical.attackers.length>0,
   criticalAttackers:critical.attackers.map(i=>i===0?a:b),friendly}];
 }
 return {bodies,criticalRng:rng,criticalContacts:contacts,impactSerial:serial,impacts};
}

function eliminateTeamBodies(bodies,previous,serial) {
 let events=[];
 const next=bodies.map((b,index)=>{
  if(b.eliminated) return b;
  const reason=Math.hypot(b.x,b.y)>ARENA_RADIUS+8?'ringout':b.energy<=0?'spin':null;
  if(!reason) return b;
  const eliminated={...b,eliminated:true,eliminationReason:reason};
  events=[...events,{id:++serial,index,reason,body:eliminated,previousBody:previous[index]}];
  return eliminated;
 });
 return {bodies:next,events,serial};
}

function stepTeam(match,dt) {
 if(match.phase!=='active'||!Number.isFinite(dt)||dt<=0) return match;
 const duration=Math.min(dt,.1),count=Math.ceil(duration/(1/120)),slice=duration/count;
 let current=match;
 for(let i=0;i<count;i++) {
  const moved=current.bodies.map(b=>b.eliminated||b.energy<=0?b:move(b,slice));
  const collisionState=teamCollisions(current,moved,slice);
  const eliminated=eliminateTeamBodies(collisionState.bodies,current.bodies,current.eliminationSerial);
  const elapsed=current.elapsed+slice,result=teamResult(eliminated.bodies,elapsed,eliminated.events);
  current={...current,...collisionState,bodies:eliminated.bodies,elapsed,result,phase:result?'finished':'active',
   eliminations:[...current.eliminations,...eliminated.events],eliminationSerial:eliminated.serial};
  if(result) break;
 }
 return current;
}
