"""Sound defaults, persistence, title controls, and mode gesture regression."""
import asyncio
from playwright.async_api import async_playwright
from browser_flow_helpers import select_solo_match, start_battle

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        for width,height in [(390,844),(1280,800)]:
            context=await browser.new_context(viewport={'width':width,'height':height})
            page=await context.new_page()
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            await page.route('**/googletagmanager.com/**',lambda route:route.abort())
            await page.add_init_script('''window.starts=0;const start=AudioBufferSourceNode.prototype.start;
              AudioBufferSourceNode.prototype.start=function(...args){window.starts++;return start.apply(this,args)};''')
            await page.goto('http://127.0.0.1:8766/blade/')
            await page.locator('#start-team:enabled').wait_for()
            assert await page.locator('#title-sound').get_attribute('aria-pressed')=='true'
            assert await page.evaluate('window.starts')==0
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            box=await page.locator('#title-sound').bounding_box()
            assert box['y']+box['height'] <= height, box
            await page.locator('#title-sound').click()
            await page.reload()
            await page.locator('#start-exhibition:enabled').wait_for()
            assert await page.locator('#title-sound').get_attribute('aria-pressed')=='false'
            await page.locator('#start-exhibition').click()
            await select_solo_match(page)
            await start_battle(page)
            assert await page.locator('#sound').get_attribute('aria-pressed')=='false'
            assert await page.evaluate('window.starts')==0
            await page.locator('#sound').click()
            await page.wait_for_function('window.starts>0')
            await page.reload()
            await page.locator('#start-team:enabled').wait_for()
            assert await page.locator('#title-sound').get_attribute('aria-pressed')=='true'
            assert await page.evaluate('window.starts')==0
            await page.locator('#start-team').click()
            await page.wait_for_function('window.starts>0')
            await page.reload()
            await page.locator('#start-pref-team:enabled').wait_for()
            assert await page.evaluate('window.starts')==0
            await page.locator('#start-pref-team').click()
            await page.wait_for_function('window.starts>0')
            assert not errors,errors
            await context.close()
        print('Sound preference browser: mobile/desktop, lazy ON, persisted OFF/ON, title/battle sync PASS')
        await browser.close()
asyncio.run(main())
