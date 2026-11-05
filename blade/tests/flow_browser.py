"""Screen-flow regression checks, including cancellation and navigation without a reload."""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, start_battle

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766'

async def main():
    source = (Path(__file__).parents[1] / 'engine.mjs').read_text().replace(
        'export function step(match,dt)', 'function actualStep(match,dt)')
    source += """
export function step(match,dt) {
 const next=actualStep(match,dt);
 return next.elapsed<.1?next:{...next,phase:'finished',result:{winner:'player',reason:'time'}};
}
"""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width in [1280, 390, 320]:
            page = await browser.new_page(viewport={'width':width,'height':844})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.route('**/googletagmanager.com/**', lambda route: route.abort())
            await page.route('**/engine.mjs*', lambda route: route.fulfill(content_type='text/javascript',body=source))
            await page.goto(BASE+'/blade/')
            assert await page.locator('#title-screen').is_visible()
            assert await page.locator('#choose-region').is_hidden()
            assert await page.locator('#battle').is_hidden()
            assert await page.locator('#title-screen button:disabled').count() >= 2
            await enter_selection(page)
            assert await page.locator('#title-screen').is_hidden()
            assert await page.locator('.region-card').count() == 10
            await page.locator('#prefecture-filter').select_option(label='大阪府')
            assert await page.locator('.region-card:visible').count() == 2
            await page.locator('#region-search').fill('存在しないまち')
            assert await page.locator('.region-card:visible').count() == 0
            assert await page.locator('#no-regions').is_visible()
            await page.locator('#region-search').fill('おおさかし')
            assert await page.locator('.region-card:visible').count() == 1
            await page.get_by_role('button',name='大阪市を選ぶ',exact=True).click()
            await page.locator('#select-cpu').click()
            await page.locator('#prefecture-filter').select_option(label='北海道')
            await page.locator('#region-search').fill('')
            await page.get_by_role('button',name='札幌市を選ぶ',exact=True).click()
            preview = await page.locator('#match-preview').inner_text()
            assert '大阪市' in preview and '札幌市' in preview
            await page.locator('#confirm-match').click()
            assert await page.locator('#vs-screen').is_visible()
            assert await page.locator('#choose-region').is_hidden()
            assert '大阪市' in await page.locator('#vs-preview').inner_text()
            assert '札幌市' in await page.locator('#vs-preview').inner_text()
            await page.locator('#vs-back').click()
            await page.wait_for_timeout(2000)
            assert await page.locator('#choose-region').is_visible(), 'cancelled VS timer must not enter battle'
            await page.locator('#confirm-match').click()
            await page.locator('#battle').wait_for(timeout=3000)
            assert await page.locator('#vs-screen').is_hidden()
            assert await page.locator('#choose-region').is_hidden()
            assert await page.locator('#player-name').inner_text() == '大阪市'
            assert await page.locator('#cpu-name').inner_text() == '札幌市'
            await page.locator('#battle-back').click()
            assert await page.locator('#choose-region').is_visible()
            await start_battle(page)
            await page.locator('#launch').click()
            assert await page.locator('#battle-back').is_disabled()
            await page.locator('#result').wait_for()
            await page.locator('#reselect').click()
            assert await page.locator('#choose-region').is_visible()
            await start_battle(page)
            await page.locator('#launch').click()
            await page.locator('#result').wait_for()
            await page.locator('#result-title-home').click()
            assert await page.locator('#title-screen').is_visible()
            await page.wait_for_timeout(500)
            assert await page.locator('#battle').is_hidden()
            await enter_selection(page)
            await page.locator('#title-back').click()
            assert await page.locator('#title-screen').is_visible()
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors, errors
            print(f'{width}px: title, filters, both selections, VS cancellation, back, results PASS')
            await page.close()
        await browser.close()

asyncio.run(main())
