"""Local UI smoke test. Run against an HTTP server: python browser_smoke.py [base URL]."""
import asyncio
import sys
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, start_battle, replay_battle

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for width, height, touch in [(1280, 1000, False), (390, 844, True), (320, 740, True)]:
            page = await browser.new_page(viewport={'width': width, 'height': height}, has_touch=touch, is_mobile=touch)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.route('**/googletagmanager.com/**', lambda route: route.abort())
            await page.goto(BASE + '/blade/')
            await enter_selection(page)
            assert await page.locator('.prefecture-card').count() == 47
            assert '大阪市' in await page.locator('#match-preview .player').text_content()
            assert await page.locator('.region-card meter').count() == 0
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.locator('.prefecture-card[data-prefecture="神奈川県"]').click()
            await page.locator('#regions').get_by_role('button', name='横浜市を選ぶ').click()
            assert '横浜市' in await page.locator('#match-preview .player').text_content()
            await page.locator('#shuffle').click()
            await start_battle(page)
            assert await page.locator('#player-name').inner_text() == '横浜市'
            assert (await page.locator('#player-grit').inner_text()).startswith('底力 ')
            assert (await page.locator('#player-spin-power').inner_text()).startswith('回転力 ')
            await page.locator('#battle').scroll_into_view_if_needed()
            # A tap near the edge must not launch; cancellation must not launch either.
            await page.locator('#arena').scroll_into_view_if_needed()
            box = await page.locator('#arena').bounding_box()
            center=await page.evaluate("async()=>{const m=await import('/blade/depth-view.mjs');return m.projectPoint({x:0,y:95},10*m.VIEW_TILT)}")
            await page.mouse.click(box['x']+box['width']*(240/440),box['y']+box['height']*((220+center['y'])/440))
            assert await page.locator('#launch').is_enabled(), 'tap must not launch'
            if touch:
                await page.locator('#arena').scroll_into_view_if_needed()
                box = await page.locator('#arena').bounding_box()
                x = box['x'] + box['width'] / 2
                y = box['y'] + box['height'] * ((220+center['y']) / 440)
                session = await page.context.new_cdp_session(page)
                # Actual touch drag, not mouse emulation.
                await session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
                await session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x+12, 'y': y+45}]})
                await session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            else:
                await page.locator('#launch').click()
            assert await page.locator('#launch').is_disabled()
            await page.locator('#pause').click()
            assert await page.locator('#pause-cover').is_visible()
            time = await page.locator('#time').inner_text()
            await page.wait_for_timeout(400)
            assert await page.locator('#time').inner_text() == time
            await page.locator('#resume').click()
            await page.wait_for_function('document.getElementById("status").textContent.startsWith("決着！")', timeout=48000)
            assert await page.locator('#result').is_hidden(), 'allow the defeat animation before overlay'
            assert await page.locator('#launch').is_disabled()
            assert await page.locator('#shuffle').is_disabled()
            await page.wait_for_timeout(800)
            await page.locator('#arena').screenshot(path=f'/tmp/blade-shatter-{width}.png')
            await page.wait_for_function('!document.getElementById("result").hidden', timeout=3000)
            assert await page.locator('#pause').is_disabled()
            arena_box=await page.locator('#arena').bounding_box()
            result_box=await page.locator('#result').bounding_box()
            assert result_box['y']-arena_box['y']<arena_box['height']*.05
            assert result_box['height']<arena_box['height']*.55
            if width == 320:
                detail = await page.locator('#result-detail').inner_text()
                await page.locator('#result-detail').evaluate("el=>el.textContent='横浜市 vs かすみがうら市 · 同時にゲージ切れ・超過ダメージの少ない側の勝利'")
                compact_box = await page.locator('#result').bounding_box()
                assert compact_box['height'] < arena_box['height']*.55, 'long result must leave the winner visible'
                await page.locator('#result-detail').evaluate('(el,text)=>el.textContent=text', detail)
            await page.locator('.arena-wrap').screenshot(path=f'/tmp/blade-result-{width}.png')
            await replay_battle(page)
            assert await page.locator('#time').inner_text() == '45'
            assert await page.locator('#launch').is_enabled()
            await page.screenshot(path=f'/tmp/blade-{width}.png', full_page=True)
            assert not errors, errors
            print(f'{width}px: selection, launch, pause, finish, replay, layout PASS')
            await page.close()
        page = await browser.new_page(reduced_motion='reduce')
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.goto(BASE + '/blade/')
        await enter_selection(page)
        await start_battle(page)
        await page.locator('#launch').click()
        await page.wait_for_function('document.getElementById("status").textContent.startsWith("決着！")', timeout=48000)
        await page.wait_for_function('!document.getElementById("result").hidden', timeout=1000)
        await replay_battle(page)
        assert await page.locator('#launch').is_enabled()
        await page.close()
        print('Reduced motion: short finish and replay PASS')
        page = await browser.new_page()
        await page.route('**/regions.json*', lambda route: route.fulfill(status=503, body='Unavailable'))
        await page.goto(BASE + '/blade/')
        await page.wait_for_function('document.getElementById("load-error").textContent.includes("読み込めません")')
        assert await page.locator('#start-exhibition').is_disabled()
        print('Map failure: readable error and disabled controls PASS')
        await browser.close()

asyncio.run(main())
