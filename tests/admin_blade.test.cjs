const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const nodes=new Map();
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',addEventListener(){}});return nodes.get(id);}};
 const ctx=vm.createContext({document,Date,console,jmAdmin:{token:()=>''},fetch:async()=>({ok:true,json:async()=>[{id:'city-a',name:'青森市',prefecture:'青森県'}]})});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../admin_analytics.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 return {ctx,node:document.getElementById('blade_analytics'),document};
}
const sample={days:7,summary:{starts:10,completed:8,unfinished:2,wins:3,losses:3,draws:2},daily:[],regions:[{region_id:'city-a',mode:'team',side:'player',starts:10,completed:8,unfinished:2,wins:3,losses:3,draws:2}]};
test('caps period at 30 days and resolves names with cached lookup',async()=>{
 const {ctx,node}=setup();const calls=[];let lookups=0;ctx.fetch=async()=>{lookups++;return{ok:true,json:async()=>[{id:'city-a',name:'青森市',prefecture:'青森県'}]};};
 ctx.api=async(a,p)=>{calls.push([a,p.days]);return sample;};
 await ctx.loadBlade(365);await ctx.loadBlade(7);
 assert.deepEqual(calls,[['blade_analytics',30],['blade_analytics',7]]);assert.equal(lookups,1);
 assert.match(node.innerHTML,/引き分けを除く/);assert.match(node.innerHTML,/30日/);
 assert.match(ctx.document.getElementById('blade-region-rows').innerHTML,/青森市/);
 assert.match(ctx.document.getElementById('blade-region-rows').innerHTML,/50\.0%/);
});
test('filters side and mode, escapes names and excludes draws from rate',()=>{
 const {ctx}=setup();const rows=[...sample.regions,{...sample.regions[0],side:'cpu',mode:'single',starts:20}];
 assert.equal(ctx.bladeRows(rows,{side:'player',mode:'team',search:''},new Map()).length,1);
 assert.equal(ctx.bladeWinRate({wins:0,losses:0,draws:2}),'—');
 assert.match(ctx.bladeRowHtml({...rows[0],region_id:'<img>'},new Map()),/&lt;img&gt;/);
});
test('stale results and errors cannot replace current results',async()=>{
 const {ctx,node}=setup();const requests=[];ctx.api=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
 const old=ctx.loadBlade(7),recent=ctx.loadBlade(30);requests[1].resolve({...sample,days:30});await recent;
 requests[0].reject(Error('stale-failure'));await old;assert.match(node.innerHTML,/直近30日/);assert.doesNotMatch(node.innerHTML,/stale-failure/);
 const fail=ctx.loadBlade(7);requests[2].reject(Error('<bad>'));assert.equal(await fail,false);assert.match(node.innerHTML,/&lt;bad&gt;/);
});
test('empty data explains tracking starts now',async()=>{
 const {ctx,node}=setup();ctx.api=async()=>({days:7,summary:{},regions:[],daily:[]});await ctx.loadBlade(7);
 assert.match(node.innerHTML,/集計開始後/);assert.match(ctx.document.getElementById('blade-region-rows').innerHTML,/まだ記録がありません/);
});
