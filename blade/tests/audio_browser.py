"""Decode real game assets and verify sound controls without publishing."""
import asyncio
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, start_battle, replay_battle, select_solo_match
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        page=await browser.new_page()
        await page.add_init_script('''window.audioProbe={starts:0,stops:0};
        const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
        AudioBufferSourceNode.prototype.start=function(...args){audioProbe.starts++;return start.apply(this,args)};
        AudioBufferSourceNode.prototype.stop=function(...args){audioProbe.stops++;return stop.apply(this,args)};''')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.route('**/googletagmanager.com/**',lambda r:r.abort())
        await page.goto('http://127.0.0.1:8766/blade/')
        await enter_selection(page)
        await select_solo_match(page)
        await start_battle(page)
        assert await page.evaluate('audioProbe.starts')==0
        await page.locator('#sound').click()
        await page.wait_for_function('audioProbe.starts>0')
        await page.locator('#launch').click()
        await page.wait_for_function('audioProbe.starts>=2')
        await page.locator('#pause').click()
        assert await page.evaluate('audioProbe.stops')>0
        await page.locator('#sound').click()
        before=await page.evaluate('audioProbe.starts')
        await page.locator('#resume').click()
        await page.wait_for_timeout(1200)
        assert await page.evaluate('audioProbe.starts')==before
        assert not errors,errors
        print('Real audio decode, launch, pause, mute PASS')
        await browser.close()
asyncio.run(main())
