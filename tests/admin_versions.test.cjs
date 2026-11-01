const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(){
  const nodes = new Map();
  const document = {getElementById(id){ if(!nodes.has(id)) nodes.set(id,{innerHTML:'',textContent:'',value:'30'}); return nodes.get(id); }};
  const ctx = vm.createContext({document, Date, console, jmAdmin:{token:()=>''}});
  const html = fs.readFileSync(require('node:path').join(__dirname,'../admin_analytics.html'),'utf8');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], ctx);
  return {ctx, node:document.getElementById('app_versions')};
}
const sample = {total_uu:9,since:'2026-11-01',through:'2026-11-30',tracking_started_at:'2026-11-01T01:00:00Z',rows:[{version:'2.9.0',platform:'ios',uu:4},{version:'2.10.0',platform:'android',uu:7}],version_totals:[{version:'2.9.0',uu:4},{version:'2.10.0',uu:7}]};
test('renders semantic version order and deduplicated total, explains counting',()=>{
 const {ctx,node}=setup(); ctx.renderVersions(sample);
 assert.ok(node.innerHTML.indexOf('2.10.0')<node.innerHTML.indexOf('2.9.0'));
 assert.match(node.innerHTML,/期間内UU（全バージョンで重複除外）/);
 assert.match(node.innerHTML,/>9</); assert.match(node.innerHTML,/同じ人/); assert.match(node.innerHTML,/過去/);
});
test('escapes labels, handles unknown version and no records',()=>{
 const {ctx,node}=setup();ctx.renderVersions({...sample,rows:[],version_totals:[{version:'<img onerror=x>',uu:1},{version:'unknown',uu:2}]});
 assert.doesNotMatch(node.innerHTML,/<img/);assert.match(node.innerHTML,/&lt;img/);assert.match(node.innerHTML,/不明/);
 ctx.renderVersions({...sample,rows:[],version_totals:[],tracking_started_at:null});assert.match(node.innerHTML,/まだ記録がありません/);
});
test('stale results cannot overwrite latest request and errors are escaped',async()=>{
 const {ctx,node}=setup();const requests=[];
 ctx.api=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
 const a=ctx.loadVersions(7); assert.match(node.innerHTML,/読み込み中/);
 const b=ctx.loadVersions(30);requests[1].resolve(sample);await b;
 requests[0].resolve({...sample,total_uu:12345});await a;assert.doesNotMatch(node.innerHTML,/12,345/);
 const c=ctx.loadVersions(90);requests[2].reject(new Error('<broken>'));assert.equal(await c,false);assert.match(node.innerHTML,/&lt;broken&gt;/);
});
test('selected periods reach version endpoint even if app users fail',async()=>{
 for (const days of [7,30,90,180,365]) {
  const {ctx,node}=setup();const calls=[];
  vm.runInContext(`document.getElementById('days').value='${days}'`,ctx);
  ctx.api=async(action,params)=>{calls.push({action,params}); if(action==='app_users')throw Error('unavailable');return action==='app_versions'?sample:{};};
  ctx.render=ctx.renderRetention=ctx.renderStore=()=>{};
  await ctx.load();
  assert.equal(calls.find(call=>call.action==='app_versions').params.days,days);
  assert.match(node.innerHTML,/2.10.0/);
 }
});
test('late error cannot replace successful new period',async()=>{
 const {ctx,node}=setup();const requests=[];ctx.api=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
 const old=ctx.loadVersions(365), recent=ctx.loadVersions(7);
 requests[1].resolve(sample);await recent;requests[0].reject(new Error('old failure'));await old;
 assert.match(node.innerHTML,/2.10.0/);assert.doesNotMatch(node.innerHTML,/old failure/);
});
