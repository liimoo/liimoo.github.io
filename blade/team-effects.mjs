import {advanceFinishEffect,finishBody,canExplode,hiddenByFinish,drawFinishEffect} from './finish-effects.mjs?v=20261105-team';

export function createTeamEffects() {return {effects:[],pendingCues:[],final:null};}
function eliminationEffect(event,bodies,reduced) {
 const origins=bodies.map((body,index)=>index===event.index
  ? {...event.body,spin:event.previousBody?.spin??event.body.cruiseSpin??0}:body);
 const burstAt=event.reason==='ringout'?.4:.65;
 const fx={losers:[event.index],origins,reason:event.reason,burstAt,reduced,age:0,motionAge:0,
  duration:reduced?.35:burstAt+1.05,done:false};
 return {...(!reduced&&event.reason==='ringout'&&!canExplode(fx,event.index)?{...fx,duration:.55}:fx),id:event.id};
}
export function collectTeamEffects(state,match,reduced=false) {
 const fresh=(match.eliminations??[]).filter(event=>!state.effects.some(fx=>fx.id===event.id));
 const effects=[...state.effects,...fresh.map(event=>eliminationEffect(event,match.bodies,reduced))];
 const final=state.final??(match.result?{age:0,reduced,origins:match.bodies.map(body=>({...body})),
  survivors:match.bodies.flatMap((body,index)=>body.eliminated?[]:[index])}:null);
 return {...state,effects,final,pendingCues:[...state.pendingCues,...fresh.filter(event=>event.reason==='ringout').map(()=> 'ringout')]};
}
export function advanceTeamEffects(state,dt) {
 if(!Number.isFinite(dt)||dt<0)return {state,cues:[]};
 const effects=state.effects.map(fx=>advanceFinishEffect(fx,dt));
 const bursts=effects.filter((fx,index)=>!fx.reduced&&state.effects[index].age<fx.burstAt&&fx.age>=fx.burstAt&&canExplode(fx,fx.losers[0]));
 return {state:{...state,effects,pendingCues:[],final:state.final?{...state.final,age:state.final.age+dt}:null},
  cues:[...state.pendingCues,...bursts.map(()=> 'break')]};
}
function survivorBody(final,index,body) {
 if(final.reduced)return body;
 const origin=final.origins[index],slot=final.survivors.indexOf(index),count=final.survivors.length;
 if(slot<0)return body;
 const row=Math.floor(slot/3),rowCount=Math.min(3,count-row*3),column=slot%3;
 const targetX=(column-(rowCount-1)/2)*78,targetY=count>3?48+row*72:80;
 const t=final.age,decay=Math.exp(-2*t),spinTime=Math.min(t,4);
 const glide=(position,velocity,target)=>target+(position-target+((velocity??0)+2*(position-target))*t)*decay;
 return {...body,x:glide(origin.x,origin.vx,targetX),y:glide(origin.y,origin.vy,targetY),
  angle:origin.angle+(origin.spin??0)*(spinTime-spinTime*spinTime/4+spinTime**3/48)};
}
export function teamBody(state,index,body) {
 const fx=state.effects.find(effect=>effect.losers.includes(index));
 if(fx)return finishBody(fx,index,fx.origins[index]);
 return state.final?survivorBody(state.final,index,body):body;
}
export function teamHidden(state,index) {
 const fx=state.effects.find(effect=>effect.losers.includes(index));
 return Boolean(fx&&(fx.reduced?fx.done:hiddenByFinish(fx,index)));
}
export function drawTeamEffects(ctx,state,bodies) {
 for(const fx of state.effects)if(!fx.done)drawFinishEffect(ctx,fx,bodies);
}
export function teamFinishDone(state,match) {
 return Boolean(match.result&&state.final&&state.final.age>=.35&&state.effects.every(fx=>fx.done));
}
