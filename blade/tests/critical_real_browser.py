"""Observe an actual seeded match, native audio decoding/start and visible critical label."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, start_battle, select_solo_match

ROOT = Path(__file__).parents[1]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width':390,'height':844})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        app = (ROOT/'app.mjs').read_text() + '\nwindow.matchProbe=()=>({phase:match?.phase,flashes:criticalFlashes,elapsed:match?.elapsed});'
        await page.route('**/app.mjs*', lambda route: route.fulfill(content_type='text/javascript', body=app))
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.add_init_script('''
          window.criticalLabels=[];window.audioStarts=[];
          const dataUrls=new WeakMap(),bufferUrls=new WeakMap();
          const arrayBuffer=Response.prototype.arrayBuffer;
          Response.prototype.arrayBuffer=async function(){const data=await arrayBuffer.call(this);dataUrls.set(data,this.url);return data;};
          const decode=BaseAudioContext.prototype.decodeAudioData;
          BaseAudioContext.prototype.decodeAudioData=async function(data){const buffer=await decode.call(this,data);bufferUrls.set(buffer,dataUrls.get(data));return buffer;};
          const start=AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start=function(...args){const result=start.apply(this,args);window.audioStarts.push(bufferUrls.get(this.buffer));return result;};
          const fillText=CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(['会心の一撃！','痛恨の一撃！'].includes(text))window.criticalLabels.push({text,args,time:performance.now()});return fillText.call(this,text,...args);};
        ''')
        await page.goto('http://127.0.0.1:8766/blade/')
        await enter_selection(page)
        await select_solo_match(page)
        await start_battle(page)
        assert await page.locator('#sound').get_attribute('aria-pressed') == 'true'
        await page.wait_for_function('audioStarts.length>0')
        await page.locator('#angle').fill('0')
        await page.locator('#power').fill('75')
        await page.locator('#launch').click()
        await page.wait_for_function('criticalLabels.length>0', timeout=20000)
        await page.locator('#arena').screenshot(path='/tmp/blade-critical-label.png')
        await page.wait_for_function("audioStarts.some(url=>url?.includes('/critical.mp3'))")
        assert await page.evaluate("audioStarts.filter(url=>url?.includes('/critical.mp3')).length") == 1
        assert await page.evaluate("matchProbe().phase") == 'finished'
        await page.wait_for_timeout(800)
        assert await page.evaluate('matchProbe().flashes.length') == 0
        assert not errors, errors
        print('Actual Osaka vs Hokkaido seed 1: terminal critical, native audio start exactly once, visible label/expiry PASS')
        await browser.close()

asyncio.run(main())
