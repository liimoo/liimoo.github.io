"""Prefecture 3-v-3 selection, independent launch, complete battle and legacy modes."""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import select_solo_match, select_team_match
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width, height in [(1280, 900), (390, 844), (320, 568)]:
            page = await browser.new_page(viewport={'width': width, 'height': height})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            source = (Path(__file__).parents[1] / 'app.mjs').read_text() + '''
window.prefProbe=()=>({mode,player:playerTeam.map(i=>regions[i]),cpu:cpuTeam.map(i=>regions[i]),phase:match?.phase,bodies:match?.bodies});'''
            await page.route('**/app.mjs*', lambda route: route.fulfill(content_type='text/javascript', body=source))
            await page.route('**/googletagmanager.com/**', lambda route: route.abort())
            await page.goto(BASE + '/blade/')
            await page.locator('#start-pref-team').click()
            await page.locator('.prefecture-card').last.wait_for(state='attached')
            assert await page.locator('#confirm-match').is_disabled()
            assert await page.evaluate("prefProbe().player.length===0 && prefProbe().cpu.length===3")
            async def check_cpu():
                assert await page.evaluate("prefProbe().cpu.every(r=>r.kind==='県') && new Set(prefProbe().cpu.map(r=>r.prefectureCode)).size===3")
            await check_cpu()
            for _ in range(3):
                await page.locator('#shuffle').click()
                await check_cpu()
            async def choose(name):
                await page.locator(f'.prefecture-card[data-prefecture="{name}"]').click()
            await choose('北海道')
            assert await page.locator('#prefecture-back').is_hidden()
            assert await page.evaluate('prefProbe().player.length') == 1
            await choose('東京都')
            assert await page.locator('#confirm-match').is_disabled()
            await choose('大阪府')
            assert await page.locator('#confirm-match').is_enabled()
            await choose('沖縄県')
            assert await page.evaluate('prefProbe().player.length') == 3
            await choose('東京都')
            assert await page.evaluate('prefProbe().player.length') == 2
            assert await page.locator('#confirm-match').is_disabled()
            await choose('東京都')
            await page.locator('#select-cpu').click()
            while await page.locator('.team-slot:enabled').count():
                await page.locator('.team-slot:enabled').first.click()
            assert await page.locator('#confirm-match').is_disabled()
            for name in ['青森県', '千葉県', '沖縄県']:
                await choose(name)
            await check_cpu()
            await page.locator('#select-player').click()
            assert await page.locator('#match-preview .preview-fighter').count() == 6
            await page.locator('#confirm-match').click()
            assert await page.locator('#vs-preview .preview-fighter').count() == 6
            await page.locator('#skip-vs').click()
            assert await page.locator('.battle-member .energy:visible').count() == 6
            assert await page.evaluate("prefProbe().bodies.length===6")
            async def select_piece(index):
                point = await page.evaluate("async i=>{const m=await import('/blade/depth-view.mjs');return m.projectPoint({x:(i-1)*72,y:95},10*m.VIEW_TILT)}", index)
                box = await page.locator('#arena').bounding_box()
                await page.mouse.click(box['x']+box['width']*(220+point['x'])/440, box['y']+box['height']*(220+point['y'])/440)
            for index, (angle, power) in enumerate([(-40,30),(0,70),(50,100)]):
                await select_piece(index)
                await page.locator('#angle').fill(str(angle))
                await page.locator('#power').fill(str(power))
            await select_piece(0)
            assert await page.locator('#angle').input_value() == '-40'
            assert await page.locator('#power').input_value() == '30'
            point = await page.evaluate("async()=>{const m=await import('/blade/depth-view.mjs');return m.projectPoint({x:-72,y:95})}")
            box = await page.locator('#arena').bounding_box()
            x, y = box['x']+box['width']*(220+point['x'])/440, box['y']+box['height']*(220+point['y'])/440
            await page.mouse.move(x,y)
            await page.mouse.down()
            await page.mouse.move(x+15,y+20)
            await page.mouse.up()
            assert await page.evaluate("prefProbe().phase==='ready'")
            await select_piece(2)
            assert await page.locator('#angle').input_value() == '50'
            assert await page.locator('#power').input_value() == '100'
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            if width == 390:
                await page.screenshot(path='/tmp/blade-prefecture-team-ready.png')
            await page.locator('#launch').click()
            assert await page.evaluate("prefProbe().phase==='active'")
            await page.locator('#result').wait_for(timeout=35000)
            assert await page.evaluate("prefProbe().phase==='finished'")
            await page.locator('#again').click()
            await page.locator('#skip-vs').click()
            assert await page.evaluate("prefProbe().phase==='ready' && prefProbe().bodies.length===6")
            assert await page.locator('#angle').input_value() == '0'
            await page.locator('#battle-back').click()
            await page.locator('#title-back').click()
            await page.locator('#start-team').click()
            await select_team_match(page)
            assert await page.locator('#match-preview .preview-fighter').count() == 6
            assert await page.evaluate("prefProbe().player.every(r=>r.kind!=='県')")
            await page.locator('#title-back').click()
            await page.locator('#start-exhibition').click()
            await select_solo_match(page)
            assert await page.locator('#match-preview .preview-fighter').count() == 2
            assert await page.locator('#team-roster').is_hidden()
            assert not errors, errors
            await page.close()
        await browser.close()
    print('Prefecture team PASS: 1280/390/320, selection, shuffle, six bodies, individual launch, drag, result, replay, legacy modes')

asyncio.run(main())
