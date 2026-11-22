import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuest, allocateInitialBonus, generateEnemies, rollRewards, applyReward, resolveQuestBattle, reviveAfterLoss, QUEST_SCHEMA, saveQuest, loadQuest, clearQuest, completeReward, calculateQuestScore } from '../quest-core.mjs';

const regions = Array.from({length:40},(_,i)=>({id:`r${i}`,name:`都市${i}`,prefecture:`県${Math.floor(i/4)}`,prefectureCode:String(Math.floor(i/4)),kind:'市',points:[[0,0],[1,0],[0,1]],url:'/play/x'}));

test('初期ボーナスは合計100、能力値100以下、同じseedなら再現する',()=>{
 const a=allocateInitialBonus(7),b=allocateInitialBonus(7);
 assert.deepEqual(a,b);assert.equal(a.flat().reduce((s,n)=>s+n,0),100);assert.ok(a.flat().every(n=>n>=0&&n<=90));assert.equal(a.length,5);assert.ok(a.every(row=>row.length===4));
});

test('クエストは5人の基礎能力10とHP100から開始する',()=>{
 const quest=createQuest(regions,123);
 assert.equal(quest.schema,QUEST_SCHEMA);assert.equal(quest.roster.length,5);assert.ok(quest.roster.every(m=>m.hp===100&&m.maxHp===100&&Object.values(m.stats).every(n=>n>=10&&n<=100)));assert.equal(quest.stage,1);
});

test('敵生成はseed再現・プレイヤーと重複なし・敵数が戦数帯に合う',()=>{
 const q=createQuest(regions,8);const a=generateEnemies(regions,q,1),b=generateEnemies(regions,q,1);
 assert.deepEqual(a,b);assert.equal(a.length,1);assert.ok(a.every(e=>!q.roster.some(m=>m.regionId===e.regionId)));assert.ok(a[0].hp>=72&&a[0].hp<=78);
 assert.equal(generateEnemies(regions,q,4).length,2);
});

test('候補不足・無効な戦数・保存機能が使えない場合は安全に失敗する',()=>{
 assert.throws(()=>createQuest(regions.slice(0,4),1),/5件以上/);
 const q=createQuest(regions,8);assert.throws(()=>generateEnemies(regions,q,0),/Invalid quest stage/);
 assert.throws(()=>generateEnemies(regions,{...q,roster:regions.map(r=>({regionId:r.id}))},1),/敵候補/);
 assert.equal(saveQuest(q,{setItem(){throw Error('quota');}}),false);
 assert.equal(clearQuest({removeItem(){throw Error('blocked');}}),false);
});

test('報酬候補は重複せず、報酬適用で能力上限とHP回復を守る',()=>{
 const q=createQuest(regions,9),options=rollRewards(q,1);
 assert.ok(options.length>=2);assert.equal(new Set(options.map(x=>x.id)).size,options.length);
 const member={...q.roster[0],stats:{...q.roster[0].stats,attack:95},hp:50};
 const upgraded=applyReward({...q,roster:[member,...q.roster.slice(1)]},{id:'attack_member',amount:20},0);
 assert.equal(upgraded.roster[0].stats.attack,100);
 const healed=applyReward(q,{id:'heal',amount:50});assert.ok(healed.roster.every(m=>m.hp<=m.maxHp));
});

test('勝利後は生存者を20%回復し、敗北継続時はHP1で復帰する',()=>{
 const q=createQuest(regions,10);const depleted={...q,roster:q.roster.map((m,i)=>({...m,hp:i===0?0:50}))};
 const win=resolveQuestBattle(depleted,{winner:'player',playerHp:[0,50,100],enemyHp:[0],score:40});
 assert.equal(win.wins,1);assert.equal(win.roster[0].hp,1);assert.equal(win.roster[1].hp,70);assert.equal(win.roster[2].hp,q.roster[2].hp,'nonparticipants keep their HP');assert.equal(win.score,40);assert.equal(reviveAfterLoss({...depleted,roster:depleted.roster.map(m=>({...m,hp:0}))}).roster[0].hp,1);
});

test('参加メンバー全員が戦闘不能ならクエスト終了になり、全滅していない場合だけ継続できる',()=>{
 const q=createQuest(regions,31),allDown=q.roster.map(m=>({...m,hp:0}));
 const ended=resolveQuestBattle({...q,roster:allDown},{winner:'cpu',playerIndices:[0,1,2],playerHp:{0:0,1:0,2:0},score:0});
 assert.equal(ended.phase,'ended');
 const continuing=resolveQuestBattle({...q,roster:allDown.map((m,i)=>i===4?{...m,hp:20}:m)},{winner:'cpu',playerIndices:[0,1,2],playerHp:{0:0,1:0,2:0},score:0});
 assert.equal(continuing.phase,'loss');assert.equal(reviveAfterLoss(continuing).roster[0].hp,1);
});

test('全員向け報酬は5人全員へ、個人報酬は指定した1人だけへ適用する',()=>{
 const q=createQuest(regions,11);const all=applyReward(q,{id:'attack',amount:5});assert.ok(all.roster.every((m,i)=>m.stats.attack===q.roster[i].stats.attack+5));
 const one=applyReward(q,{id:'grit_member',amount:7},2);assert.equal(one.roster[2].stats.grit,q.roster[2].stats.grit+7);assert.ok(one.roster.filter((_,i)=>i!==2).every((m,i)=>m.stats.grit===q.roster[i<2?i:i+1].stats.grit));
});

test('最大HP・スコア・任意能力の報酬は対象者と上限を守る',()=>{
 const q=createQuest(regions,33),maxAll=applyReward(q,{id:'max_hp',amount:10}),maxOne=applyReward(q,{id:'max_hp_member',amount:10},1);
 assert.ok(maxAll.roster.every(m=>m.maxHp===110&&m.hp===110));assert.equal(maxOne.roster[1].maxHp,110);assert.equal(maxOne.roster[0].maxHp,100);
 const score=applyReward(q,{id:'score',amount:.3});assert.equal(score.scoreCoefficient,q.scoreCoefficient+.3);
 const allocation=[{memberIndex:0,key:'attack',amount:3},{memberIndex:0,key:'missing',amount:50},{memberIndex:1,key:'grit',amount:4}];
 const allocated=applyReward(q,{id:'parameter_all',amount:7},null,allocation);assert.equal(allocated.roster[0].stats.attack,q.roster[0].stats.attack+3);assert.equal(allocated.roster[1].stats.grit,q.roster[1].stats.grit+4);
 const scalar=applyReward(q,{id:'parameter_member',amount:7},2,'spin');assert.equal(scalar.roster[2].stats.spin,q.roster[2].stats.spin+7);assert.equal(scalar.roster[1].stats.spin,q.roster[1].stats.spin);
 assert.ok(rollRewards(q,1).every(r=>!['heal','heal_member'].includes(r.id)));
});

test('戦闘中断データを保存して読み戻し、破損・別スキーマは無視する',()=>{
 const data=new Map(),storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)||null,removeItem:k=>data.delete(k)};const q={...createQuest(regions,12),phase:'battle',battle:{playerIndices:[0],battleState:{phase:'active',elapsed:12,bodies:[{x:1,y:2,energy:.7}]}}};assert.equal(saveQuest(q,storage),true);assert.deepEqual(loadQuest(storage),q);data.set('city-blade-quest-v1','{');assert.equal(loadQuest(storage),null);data.set('city-blade-quest-v1',JSON.stringify({...q,schema:999}));assert.equal(loadQuest(storage),null);
});

test('報酬後は次の戦へ、セーブ失敗はゲーム進行を止めない',()=>{
 const q=createQuest(regions,13),won=resolveQuestBattle(q,{winner:'player',playerHp:[100,90,80],score:120});const next=completeReward(won);assert.equal(next.stage,2);assert.equal(next.phase,'stage_intro');assert.equal(saveQuest(q,{setItem(){throw Error('full');}}),false);
});

test('クエスト戦闘は1〜3人編成を既存の3対3エンジンで実行できる',async()=>{
 const {createQuestMatch,launchTeam,step}=await import('../engine.mjs');const player=regions.slice(0,2).map((region,i)=>({region,hp:80-i*10,maxHp:100,stats:{attack:30,knockback:40,spin:50,grit:60}}));const cpu=regions.slice(8,10).map(region=>({region,hp:70,maxHp:90,stats:{attack:20,knockback:20,spin:20,grit:20}}));let match=createQuestMatch(player,cpu,22);assert.equal(match.bodies.length,4);assert.equal(match.bodies[0].energy,.8);assert.equal(match.bodies[0].attack,30);match=launchTeam(match,player.map(()=>({direction:{x:0,y:-1},power:.7})));assert.equal(match.phase,'active');const next=step(match,1/60);assert.ok(next.elapsed>0);assert.equal(match.elapsed,0);
});

test('最大HPが高い仲間は同じ衝突で割合HPの減少が小さい',async()=>{
 const {createQuestMatch,launchTeam,step}=await import('../engine.mjs');
 const run=async maxHp=>{let match=createQuestMatch([{region:regions[0],hp:maxHp,maxHp,stats:{attack:100,knockback:10,spin:10,grit:10}}],[{region:regions[1],hp:100,maxHp:100,stats:{attack:100,knockback:10,spin:10,grit:10}}],3);match=launchTeam(match,[{direction:{x:0,y:-1},power:1}]);for(let i=0;i<100;i++)match=step(match,1/120);return match.bodies[0].energy;};
 assert.ok(await run(200)>await run(100));
});

test('戦闘スコアは開始後に敵から減らしたHP分だけを加算する',()=>{
 assert.equal(calculateQuestScore([{startHpPoints:60,maxHpPoints:100,energy:.4}],1.5),30);
 assert.equal(calculateQuestScore([{startHpPoints:60,maxHpPoints:100,energy:.8}],1),0);
 assert.equal(calculateQuestScore(null,1),0);assert.equal(calculateQuestScore([{energy:.5}],-1),0);
});

test('クエストの回転力はGodot同様に消耗量と回復速度を変える',async()=>{
 const {createQuestMatch,launchTeam,step}=await import('../engine.mjs');
 const run=spin=>{let m=createQuestMatch([{region:regions[0],hp:100,maxHp:100,stats:{attack:10,knockback:10,spin,grit:10}}],[{region:regions[1],hp:100,maxHp:100,stats:{attack:10,knockback:10,spin:10,grit:10}}],14);m=launchTeam(m,[{direction:{x:0,y:0},power:.5}]);m={...m,bodies:m.bodies.map((b,i)=>i?b:{...b,spin:0,cruiseSpin:15})};return step(m,.1).bodies[0];};
 const low=run(10),high=run(100);assert.ok(high.energy>low.energy);assert.ok(high.spin>low.spin);
});

test('セーブデータのHP・能力値・メンバーIDを検証し、ローカル保存不可でも安全に失敗する',()=>{
 const q=createQuest(regions,14),data=new Map(),storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)||null,removeItem:k=>data.delete(k)};saveQuest(q,storage);data.set('city-blade-quest-v1',JSON.stringify({...q,roster:q.roster.map((m,i)=>i?m:{...m,hp:999})}));assert.equal(loadQuest(storage),null);assert.equal(saveQuest(q,{get setItem(){throw Error('blocked');}}),false);assert.equal(loadQuest({get getItem(){throw Error('blocked');}}),null);
});
