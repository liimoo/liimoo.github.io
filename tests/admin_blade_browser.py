"""Admin City Blade UI regression; mocked auth/API, no production telemetry."""
import json
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BLADE_TEST_URL', 'http://127.0.0.1:8766')
AUTH = '''window.jmAdmin={token:()=> 'test',request:async(action,params)=> {
window.calls.push([action,params]);
if(action==='blade_analytics')return {ok:true,status:200,data:{days:params.days,summary:{starts:20,completed:18,unfinished:2},regions:[
{region_id:'pref-hokkaido',mode:'single',side:'player',starts:10,completed:8,unfinished:2,wins:3,losses:3,draws:2},
{region_id:'pref-hokkaido',mode:'team',side:'cpu',starts:10,completed:10,unfinished:0,wins:9,losses:1,draws:0}]}};
return {ok:true,status:200,data:{}};
}};window.calls=[];'''
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in [390, 1280]:
        page = browser.new_page(viewport={'width':width,'height':900})
        page.route('**/admin_auth.js',lambda route:route.fulfill(body=AUTH,content_type='application/javascript'))
        page.goto(BASE+'/admin_analytics.html')
        page.locator('#blade-region-rows').get_by_text('北海道',exact=True).wait_for()
        assert page.locator('#blade-region-rows tr').count()==1
        assert '50.0%' in page.locator('#blade-region-rows').inner_text()
        page.select_option('#blade-side','cpu')
        assert '90.0%' in page.locator('#blade-region-rows').inner_text()
        page.select_option('#blade-mode','single')
        assert '一致する記録がありません' in page.locator('#blade-region-rows').inner_text()
        page.select_option('#days','365')
        page.get_by_text('都市ブレード Web版 · 直近30日',exact=False).wait_for()
        assert page.evaluate("calls.filter(c=>c[0]==='blade_analytics').at(-1)[1].days")==30
        page.fill('#blade-search','存在しない都市')
        assert '一致する記録がありません' in page.locator('#blade-region-rows').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
        page.close()
    browser.close()
print(json.dumps({'ok':True,'widths':[390,1280],'mocked':True}))
