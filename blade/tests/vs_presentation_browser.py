"""VS readability, three rosters, viewport fit and reduced-motion presentation."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, select_solo_match, select_team_match

ROOT = Path(__file__).parents[1]

async def inside(page, selector):
    box = await page.locator(selector).bounding_box()
    size = page.viewport_size
    assert box and box['x'] >= -1 and box['y'] >= -1, (selector, box)
    assert box['x'] + box['width'] <= size['width'] + 1, (selector, box, size)
    assert box['y'] + box['height'] <= size['height'] + 1, (selector, box, size)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for mode, width, height, reduced in [
            ('single',1280,800,False),('single',320,568,False),
            ('team',390,844,False),('pref-team',320,568,False),
            ('team',844,390,False),('pref-team',390,844,True)]:
            page = await browser.new_page(viewport={'width':width,'height':height},
                                          reduced_motion='reduce' if reduced else 'no-preference')
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            await page.route('**/googletagmanager.com/**',lambda r:r.abort())
            # Hold only the navigation timer, leaving real CSS animations intact.
            source=(ROOT/'flow.mjs').read_text()
            import re
            source=re.sub(r"(timer=setTimeout\(\(\)=>\{if\(screen==='vs'\)show\('battle'\);\},).*?(\);)",r'\g<1>60000\2',source)
            assert '60000' in source
            await page.route('**/flow.mjs*',lambda r:r.fulfill(content_type='text/javascript',body=source))
            await page.goto('http://127.0.0.1:8766/blade/')
            if mode=='single':
                await enter_selection(page); await select_solo_match(page)
            elif mode=='team':
                await page.locator('#start-team').click();await select_team_match(page)
            else:
                await page.locator('#start-pref-team').click()
                for name in ['北海道','東京都','大阪府']:
                    await page.locator(f'.prefecture-card[data-prefecture="{name}"]').click()
            await page.locator('#confirm-match').click()
            await page.wait_for_timeout(1100)
            assert await page.locator('#vs-preview .preview-fighter').count()==(2 if mode=='single' else 6)
            for selector in ['#vs-heading','#skip-vs','#vs-back','#vs-preview']:
                await inside(page,selector)
            for item in await page.locator('#vs-preview .preview-fighter h3').all():
                assert await item.is_visible()
                assert await item.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1 && el.scrollHeight<=el.clientHeight+1')
            if reduced:
                assert await page.locator('#vs-preview').evaluate('el=>el.getAnimations({subtree:true}).every(a=>a.playState!=="running")')
            await page.screenshot(path=f'/tmp/blade-vs-{mode}-{width}.png')
            await page.locator('#vs-back').click()
            assert await page.locator('#choose-region').is_visible()
            await page.locator('#confirm-match').click()
            await page.locator('#skip-vs').click()
            assert await page.locator('#battle').is_visible()
            assert not errors,errors
            await page.close()
            print(f'{mode} {width}x{height} reduced={reduced}: PASS',flush=True)
        # Unmodified flow must still advance automatically after the short face-off.
        page=await browser.new_page()
        await page.route('**/googletagmanager.com/**',lambda r:r.abort())
        await page.goto('http://127.0.0.1:8766/blade/')
        await enter_selection(page);await select_solo_match(page)
        await page.locator('#confirm-match').click()
        await page.locator('#battle').wait_for(timeout=5500)
        assert await page.locator('#launch').is_enabled()
        await page.close()
        print('Natural VS transition to launch preparation: PASS',flush=True)
        await browser.close()

asyncio.run(main())
