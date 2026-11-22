export const QUEST_SCHEMA = 1;
export const STAT_KEYS = Object.freeze(['attack','knockback','spin','grit']);
export const STAT_LABELS = Object.freeze({attack:'攻撃力',knockback:'弾き力',spin:'回転力',grit:'底力',maxHp:'最大HP'});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const bands=[
 {from:1,to:2,count:[1,1],hp:[72,78],stats:[10,15]},
 {from:3,to:5,count:[2,2],hp:[60,70],stats:[10,15]},
 {from:6,to:7,count:[1,1],hp:[110,120],stats:[15,20]},
 {from:8,to:10,count:[3,3],hp:[40,50],stats:[20,30]},
 {from:11,to:12,count:[1,1],hp:[120,150],stats:[25,35]},
 {from:13,to:17,count:[2,2],hp:[90,110],stats:[35,40]},
 {from:18,to:22,count:[3,3],hp:[100,120],stats:[40,45]},
 {from:23,to:24,count:[3,3],hp:[120,150],stats:[40,60]},
 {from:25,to:27,count:[1,1],hp:[180,210],stats:[60,70]},
 {from:28,to:Infinity,count:[3,3],hp:[140,180],stats:[80,100]}
];
const rewards=(late)=>[
 ['attack',late?15:10,.5],['attack_member',late?30:20,1],['parameter_all',late?15:10,.5],['parameter_member',late?30:20,1],
 ['knockback',late?15:10,.5],['knockback_member',late?30:20,1],['spin',late?15:10,1],['spin_member',late?30:20,1],
 ['grit',late?15:10,.5],['grit_member',late?30:20,1],['max_hp',late?10:5,1],['max_hp_member',late?15:10,.5],
 ['score',late?.4:.3,.5],['swap',late?1:.8,.5],['heal',50,.5],['heal_member',50,.5]
].map(([id,amount,rate])=>({id,amount,rate}));
function random(seed){let s=Number(seed)>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const int=(rng,min,max)=>min+Math.floor(rng()*(max-min+1));
const eligible=regions=>regions.filter(r=>r&&r.kind==='市'&&r.id&&Array.isArray(r.points)&&r.points.length>=3);
export function allocateInitialBonus(seed=1){
 const rng=random(seed),slots=Array.from({length:20},()=>0);let remaining=100;
 while(remaining){const available=slots.map((v,i)=>v<90?i:-1).filter(i=>i>=0);if(!available.length)throw new Error('Initial bonus exceeds capacity');const index=available[int(rng,0,available.length-1)];slots[index]++;remaining--;}
 return Array.from({length:5},(_,i)=>slots.slice(i*4,i*4+4));
}
export function createQuest(regions,seed=Date.now()){
 const pool=eligible(regions);if(pool.length<5)throw new Error('クエストには市区町村が5件以上必要です');
 const rng=random(seed),chosen=[],ids=new Set();while(chosen.length<5){const region=pool[int(rng,0,pool.length-1)];if(ids.has(region.id))continue;ids.add(region.id);chosen.push(region);}
 const bonuses=allocateInitialBonus(seed^0x51f15e);
 const roster=chosen.map((region,i)=>({regionId:region.id,hp:100,maxHp:100,stats:Object.fromEntries(STAT_KEYS.map((key,j)=>[key,10+bonuses[i][j]]))}));
 return {schema:QUEST_SCHEMA,seed:Number(seed)>>>0,rngState:(Number(seed)>>>0)||1,stage:1,wins:0,score:0,scoreCoefficient:1,roster,phase:'initial_bonus',enemyIds:[],battle:null,rewardOptions:[],history:[],createdAt:Date.now()};
}
export function generateEnemies(regions,quest,stage=quest.stage){
 const band=bands.find(b=>stage>=b.from&&stage<=b.to);if(!band)throw new Error('Invalid quest stage');
 const pool=eligible(regions).filter(r=>!quest.roster.some(m=>m.regionId===r.id));if(!pool.length)throw new Error('敵候補の地域がありません');
 const rng=random((quest.seed+stage*0x9e3779b9)>>>0),count=int(rng,...band.count),enemies=[],used=new Set();
 for(let i=0;i<count;i++){let region;do{region=pool[int(rng,0,pool.length-1)];}while(used.has(region.id)&&used.size<pool.length);used.add(region.id);
  enemies.push({regionId:region.id,hp:int(rng,...band.hp),maxHp:band.hp[1],stats:{attack:int(rng,...band.stats),knockback:int(rng,...band.stats),spin:int(rng,...band.stats),grit:int(rng,...band.stats)}});
 }
 return enemies;
}
export function rollRewards(quest,stage=quest.stage){
 const rng=random((quest.seed^Math.imul(stage,0x45d9f3b))>>>0),injured=quest.roster.some(m=>m.hp>0&&m.hp<m.maxHp),pool=rewards(stage>=6).filter(r=>!['heal','heal_member'].includes(r.id)||injured),picked=[];
 while(picked.length<Math.min(5,pool.length)){const total=pool.reduce((n,r)=>n+r.rate,0);let roll=rng()*total,index=pool.findIndex(r=>(roll-=r.rate)<=0);if(index<0)index=pool.length-1;picked.push(pool.splice(index,1)[0]);}
 return picked;
}
export function applyReward(quest,reward,memberIndex=null,statKey=null){
 const roster=quest.roster.map((member,index)=>{
  if(reward.id==='heal')return {...member,hp:Math.min(member.maxHp,member.hp+reward.amount)};
  if(reward.id==='swap')return member;
  if(reward.id==='heal_member')return index===memberIndex?{...member,hp:Math.min(member.maxHp,member.hp+reward.amount)}:member;
  if(reward.id==='score')return member;
  if(reward.id==='max_hp'||reward.id==='max_hp_member'){
   if(reward.id==='max_hp_member'&&index!==memberIndex)return member;
   const maxHp=member.maxHp+reward.amount;return {...member,maxHp,hp:Math.min(maxHp,member.hp+reward.amount)};
  }
  const allStats=['attack','knockback','spin','grit'].includes(reward.id);
  const targets=allStats||reward.id==='parameter_all'||(reward.id.endsWith('_member')&&index===memberIndex);
  if(!targets)return member;
  const stats={...member.stats};
  if(reward.id==='parameter_all'||reward.id==='parameter_member'){
   if(Array.isArray(statKey)){for(const item of statKey)if(item.memberIndex===index&&item.key in stats)stats[item.key]=clamp(stats[item.key]+item.amount,0,100);}
   else if(statKey&&statKey in stats)stats[statKey]=clamp(stats[statKey]+reward.amount,0,100);
  }else{const key=reward.id.replace('_member','');if(key in stats)stats[key]=clamp(stats[key]+reward.amount,0,100);}
  return {...member,stats};
 });
 return {...quest,roster,score:quest.score,scoreCoefficient:reward.id==='score'?quest.scoreCoefficient+reward.amount:quest.scoreCoefficient};
}
export function resolveQuestBattle(quest,result){
 const participants=new Set(result.playerIndices||quest.roster.map((_,i)=>i));
 const roster=quest.roster.map((member,i)=>{if(!participants.has(i))return member;const hp=Math.max(0,Math.min(member.maxHp,Number(result.playerHp?.[i]??0)));return {...member,hp:result.winner==='player'?(hp>0?Math.min(member.maxHp,hp+member.maxHp*.2):1):hp};});
 const history=[...quest.history,{stage:quest.stage,winner:result.winner,score:Math.max(0,Math.round(result.score||0))}];
 const next={...quest,roster,history,score:quest.score+Math.max(0,Math.round(result.score||0)),wins:quest.wins+(result.winner==='player'?1:0),phase:result.winner==='player'?'reward':roster.every(m=>m.hp<=0)?'ended':'loss'};
 if(result.winner==='player')return {...next,rewardOptions:rollRewards(next)};
 return next;
}
export function calculateQuestScore(enemyBodies,coefficient=1){
 const damage=(Array.isArray(enemyBodies)?enemyBodies:[]).reduce((sum,body)=>{
  const start=Number(body.startHpPoints??body.maxHpPoints??100),current=Number(body.maxHpPoints??100)*Number(body.energy??0);
  return sum+(Number.isFinite(start)&&Number.isFinite(current)?Math.max(0,start-current):0);
 },0);
 return Math.round(damage*Math.max(0,Number(coefficient)||0));
}
export function reviveAfterLoss(quest){return {...quest,roster:quest.roster.map(m=>({...m,hp:m.hp<=0?1:m.hp})),phase:'stage_intro'};}
export function startQuestStage(quest,regions){const enemies=generateEnemies(regions,quest);return {...quest,phase:'deploy',enemyIds:enemies.map(e=>e.regionId),battle:{enemies,playerIndices:[],seed:(quest.seed+quest.stage*7919)>>>0}};}
export function completeReward(quest){return {...quest,stage:quest.stage+1,phase:'stage_intro',rewardOptions:[],enemyIds:[],battle:null};}
const questStorageKey='city-blade-quest-v1';
function storageOrDefault(storage){return storage??globalThis.localStorage;}
function validSavedQuest(value){
 if(!value||value.schema!==QUEST_SCHEMA||!Array.isArray(value.roster)||value.roster.length!==5||!Number.isInteger(value.stage)||value.stage<1||!Number.isFinite(value.score)||!Number.isFinite(value.scoreCoefficient))return false;
 const ids=value.roster.map(m=>m?.regionId);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==5)return false;
 return value.roster.every(m=>Number.isFinite(m.hp)&&Number.isFinite(m.maxHp)&&m.maxHp>0&&m.hp>=0&&m.hp<=m.maxHp&&STAT_KEYS.every(k=>Number.isFinite(m.stats?.[k])&&m.stats[k]>=0&&m.stats[k]<=100));
}
export function saveQuest(quest,storage){try{storageOrDefault(storage).setItem(questStorageKey,JSON.stringify(quest));return true;}catch{return false;}}
export function loadQuest(storage){try{const value=JSON.parse(storageOrDefault(storage).getItem(questStorageKey)||'null');return validSavedQuest(value)?value:null;}catch{return null;}}
export function clearQuest(storage){try{storageOrDefault(storage).removeItem(questStorageKey);return true;}catch{return false;}}
