"""Presentation regression: inject deterministic terminal states through a test-only route."""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, start_battle, replay_battle
BASE = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def main():
    source=(Path(__file__).parents[1]/'engine.mjs').read_text().replace('export function step(match,dt)', 'function actualStep(match,dt)')
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        for reason, x in [('spin',0),('spin',1),('ringout',189),('ringout',300),('time',0)]:
            page=await browser.new_page(viewport={'width':390,'height':844})
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            script=source+f'''
export function step(match,dt) {{
 const next=actualStep(match,dt);
 if(next.elapsed<.3)return next;
 return {{...next,impacts:{'[...next.impacts,{x:0,y:0,age:0}]' if x==1 else 'next.impacts'},phase:'finished',result:{{winner:'{ 'draw' if reason=='time' else 'cpu'}',reason:'{reason}',tiebreak:{repr('remaining-energy') if x==1 else 'null'}}},
 bodies:next.bodies.map((b,i)=>i?b:{{...b,x:{x},y:0,vx:100,vy:0,spin:0,energy:0,
 region:{{...b.region,points:[[-1,-1],[1,-1],[1,1],[-1,1]]}}}})}};
}}
'''
            await page.route('**/engine.mjs*',lambda route:route.fulfill(content_type='text/javascript',body=script))
            await page.route('**/audio.mjs*',lambda route:route.fulfill(content_type='text/javascript',body="window.cues=[];export const createBladeAudio=()=>({stop(){},disable(){},async enable(){return true},play(cue,options){window.cues.push({cue,options})}});"))
            await page.route('**/googletagmanager.com/**',lambda route:route.abort())
            await page.goto(BASE+'/blade/')
            await enter_selection(page)
            await start_battle(page)
            await page.locator('#launch').click()
            await page.wait_for_function('document.getElementById("status").textContent.startsWith("決着！")')
            assert await page.locator('#result').is_hidden()
            assert await page.locator('#shuffle').is_disabled()
            caption=await page.locator('#arena-caption').inner_text()
            assert 'WIN' not in caption
            if reason=='spin':
                assert '回転停止' in caption
                await page.wait_for_timeout(450)
                assert '砕け散る' not in await page.locator('#status').inner_text()
            if reason!='time' and x<250:
                await page.wait_for_function('document.getElementById("status").textContent.includes("砕け散る")')
                assert await page.locator('#result').is_hidden()
                await page.wait_for_timeout(160)
                await page.locator('#arena').screenshot(path=f'/tmp/blade-sequence-{reason}.png')
            await page.wait_for_function('!document.getElementById("result").hidden',timeout=3000)
            if x==1:
                assert '超過ダメージの少ない側' in await page.locator('#result-detail').inner_text()
                assert await page.evaluate("cues.filter(x=>x.cue==='hit'&&x.options?.decisive).length")==1
            assert await page.locator('#result-title').inner_text()==('引き分け！' if reason=='time' else 'CPUの勝ち！')
            style=await page.locator('#result').evaluate('(el)=>({background:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter})')
            assert style['background']=='rgba(0, 0, 0, 0)' and style['blur']=='none'
            before=await page.locator('#arena').evaluate('(el)=>el.toDataURL()')
            await page.wait_for_timeout(400)
            after=await page.locator('#arena').evaluate('(el)=>el.toDataURL()')
            assert before!=after, 'survivor must keep moving after the dialog appears'
            count=await page.evaluate("window.dataLayer.filter(e=>e[0]==='event'&&e[1]==='blade_finish').length")
            assert count==1, 'finish callback must run once'
            await page.locator('#arena').screenshot(path=f'/tmp/blade-winner-{reason}-{x}.png')
            await replay_battle(page)
            assert await page.locator('#launch').is_enabled()
            assert not errors,errors
            print(f'{reason} x={x}: cause, sequence, result, replay PASS')
            await page.close()
        await browser.close()
asyncio.run(main())
