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
            await page.locator('#start-team').wait_for(state='visible')
            await page.wait_for_function("!document.getElementById('start-team').disabled")
            assert await page.locator('#title-screen button:disabled').count() == 1
            await enter_selection(page)
            assert await page.locator('#title-screen').is_hidden()
            assert await page.locator('.region-card').count() < 200
            assert await page.locator('#prefecture-list').is_visible()
            assert await page.locator('#selection-map').is_visible()
            sidebar = page.locator('.picker-sidebar')
            await sidebar.scroll_into_view_if_needed()
            await page.wait_for_function("document.querySelectorAll('#selection-map .map-region').length === 47")
            left = await sidebar.bounding_box()
            right = await page.locator('#selection-map').bounding_box()
            assert left['x'] + left['width'] <= right['x'] + 2, 'map stays beside list, including narrow phones'
            assert abs(left['y'] - right['y']) < left['height'], 'map and list overlap vertically'
            assert await sidebar.evaluate('(el)=>el.scrollHeight>el.clientHeight'), 'left list must scroll independently'
            await sidebar.evaluate('(el)=>{el.scrollTop=el.scrollHeight}')
            assert await sidebar.evaluate('(el)=>el.scrollTop') > 0
            after = await page.locator('#selection-map').bounding_box()
            assert abs(after['y'] - right['y']) < 1, 'scrolling list does not move map'
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
            assert await page.locator('#prefecture-list').is_hidden()
            assert await page.locator('.region-card:visible').count() > 40
            await page.locator('#region-search').fill('おおさかし')
            assert await page.locator('.region-card:visible').count() == 2
            await page.locator('#region-search').fill('存在しない都市')
            assert await page.locator('#no-regions').is_visible()
            await page.locator('#region-search').fill('')
            await page.locator('#regions').get_by_role('button',name='大阪市を選ぶ',exact=True).click()
            assert '大阪市' in await page.locator('#selected-region-detail').inner_text()
            assert await page.locator('#selected-region-detail meter').count() == 0
            assert '全地域共通' in await page.locator('#selected-region-detail').inner_text()
            await page.locator('#prefecture-back').click()
            assert await page.locator('#prefecture-list').is_visible()
            await page.locator('#select-cpu').click()
            await page.locator('#selection-map [role=button][aria-label="北海道を選ぶ"]').focus()
            await page.keyboard.press('Enter')
            await page.locator('#selection-map [role=button][aria-label="札幌市を選ぶ"]').focus()
            await page.keyboard.press('Enter')
            assert '札幌市' in await page.locator('#selected-region-detail').inner_text()
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
            print(f'{width}px: title, prefecture hierarchy, both selections, VS cancellation, back, results PASS')
            await page.close()
        page = await browser.new_page()
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.route('**/selection-map.json*', lambda route: route.fulfill(status=503, body='Unavailable'))
        await page.goto(BASE+'/blade/')
        await enter_selection(page)
        await page.wait_for_function("document.getElementById('map-caption').textContent.includes('読み込めません')")
        await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
        await page.locator('#regions').get_by_role('button',name='大阪市を選ぶ',exact=True).click()
        assert '大阪市' in await page.locator('#match-preview .player').inner_text()
        assert '読み込めません' in await page.locator('#map-caption').inner_text()
        await start_battle(page)
        assert await page.locator('#launch').is_enabled()
        print('Background map failure: list selection and battle remain usable PASS')
        await page.close()
        page = await browser.new_page()
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.route('**/selection-maps/27.json*', lambda route: route.fulfill(status=503, body='Unavailable'))
        await page.goto(BASE+'/blade/')
        await enter_selection(page)
        await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
        await page.wait_for_function("document.getElementById('map-caption').textContent.includes('読み込めません')")
        await page.locator('#regions').get_by_role('button',name='大阪市を選ぶ',exact=True).click()
        await start_battle(page)
        assert await page.locator('#player-name').inner_text() == '大阪市'
        print('Prefecture map failure: list selection and battle remain usable PASS')
        await page.close()
        page = await browser.new_page()
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        async def delayed_osaka(route):
            await asyncio.sleep(1)
            await route.continue_()
        await page.route('**/selection-maps/27.json*', delayed_osaka)
        await page.goto(BASE+'/blade/')
        await enter_selection(page)
        await page.wait_for_function("document.querySelectorAll('#selection-map .map-region').length === 47")
        await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
        await page.locator('#prefecture-back').click()
        await page.locator('.prefecture-card[data-prefecture="沖縄県"]').click()
        await page.locator('#selection-map [aria-label="石垣市を選ぶ"]').wait_for()
        await page.wait_for_timeout(1500)
        assert await page.locator('#picker-title').inner_text() == '沖縄県'
        assert await page.locator('#selection-map [aria-label="大阪市を選ぶ"]').count() == 0
        await page.locator('#regions').get_by_role('button',name='石垣市を選ぶ',exact=True).click()
        await start_battle(page)
        assert await page.locator('#player-name').inner_text() == '石垣市'
        print('Late map response cannot replace newly selected prefecture PASS')
        await page.close()
        page = await browser.new_page()
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.goto(BASE+'/blade/')
        await enter_selection(page)
        await page.locator('.prefecture-card[data-prefecture="北海道"]').click()
        await page.locator('#regions').get_by_role('button',name='伊達市を選ぶ',exact=True).click()
        await page.locator('#prefecture-back').click()
        await page.locator('.prefecture-card[data-prefecture="福島県"]').click()
        other_date = page.locator('#selection-map [aria-label="伊達市を選ぶ"]')
        await other_date.wait_for()
        assert not await other_date.evaluate('(el)=>el.classList.contains("map-selected")')
        await page.locator('#regions').get_by_role('button',name='伊達市を選ぶ',exact=True).click()
        assert await other_date.evaluate('(el)=>el.classList.contains("map-selected")')
        print('Same city name in different prefectures retains distinct selection PASS')
        await browser.close()

asyncio.run(main())
