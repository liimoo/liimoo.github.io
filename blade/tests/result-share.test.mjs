import test from 'node:test';
import assert from 'node:assert/strict';
import {resultShare} from '../result-share.mjs';
const city={name:'たつの市',prefecture:'兵庫県'},pref={name:'岩手県',prefecture:'岩手県'};
test('solo share identifies prefecture, result, and playable URL',()=>{
 const share=resultShare({mode:'single',winner:'player',player:[city],cpu:[pref]});
 assert.match(share.text,/兵庫県たつの市/);assert.match(share.text,/勝利/);
 assert.doesNotMatch(share.text,/岩手県岩手県|試作版/);
 const url=new URL(share.xUrl);assert.equal(url.origin,'https://x.com');
 assert.equal(url.searchParams.get('text'),share.text);assert.equal(url.searchParams.get('url'),share.url);
 assert.equal(share.copyText,`${share.text}\n${share.url}`);
});
test('prefecture teams list actual selected prefectures and loss',()=>{
 const share=resultShare({mode:'pref-team',winner:'cpu',player:[pref,{name:'青森県'},{name:'宮城県'}],cpu:[{name:'東京都'},{name:'大阪府'},{name:'京都府'}]});
 for(const name of ['岩手県','青森県','宮城県','東京都','大阪府','京都府'])assert.ok(share.text.includes(name));
 assert.match(share.text,/県対抗3vs3/);assert.match(share.text,/敗北/);
});
test('city team shares its prefecture and all cities including a draw',()=>{
 const share=resultShare({mode:'team',winner:'draw',player:[city,{name:'神戸市'},{name:'姫路市'}],cpu:[{name:'大阪市',prefecture:'大阪府'},{name:'堺市'},{name:'岸和田市'}]});
 assert.match(share.text,/兵庫県（たつの市・神戸市・姫路市）/);assert.match(share.text,/引き分け/);
});
