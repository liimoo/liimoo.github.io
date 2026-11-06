"""Real picker regressions for mainland/inset geography and selection state."""
import asyncio
import sys

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766'
AFFECTED = ['東京都', '島根県', '長崎県', '鹿児島県', '沖縄県']


async def national(page):
    if await page.locator('#prefecture-back').is_visible():
        await page.locator('#prefecture-back').click()
    await page.wait_for_function("!document.querySelector('#selection-map[aria-busy]')")
    assert await page.locator('.map-inset-frame').count() == 0
    assert await page.locator('.map-selection-label').count() == 0


async def open_prefecture(page, name):
    await national(page)
    await page.locator(f'.prefecture-card[data-prefecture="{name}"]').click()
    await page.locator('.map-inset-frame').first.wait_for()
    await page.wait_for_function("!document.querySelector('#selection-map[aria-busy]')")


async def select_map(page, name):
    region = page.locator(f'#selection-map .map-region[data-name="{name}"]')
    await region.focus()
    await page.keyboard.press('Enter')
    assert 'map-selected' in (await region.get_attribute('class'))
    assert name in await page.locator('.map-selection-label').all_text_contents()
    style = await region.locator('polygon').first.evaluate(
        'el=>({fill:getComputedStyle(el).fill,stroke:Number.parseFloat(getComputedStyle(el).strokeWidth)})')
    assert style['fill'] == 'rgb(245, 201, 96)', style
    assert style['stroke'] >= 2, style


async def exercise(browser, width, reduced=False):
    page = await browser.new_page(
        viewport={'width': width, 'height': 844},
        reduced_motion='reduce' if reduced else 'no-preference')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.route('**/googletagmanager.com/**', lambda route: route.abort())
    await page.add_init_script('''
        window.selectionFlashes = 0;
        const animate = Element.prototype.animate;
        Element.prototype.animate = function(...args) {
            if (this.matches('#selection-map .map-selected')) selectionFlashes++;
            return animate.apply(this, args);
        };
    ''')
    await page.goto(BASE + '/blade/')
    await page.locator('#start-exhibition').click()
    await open_prefecture(page, '東京都')
    for name in ['新宿区', '大島町', '小笠原村']:
        await select_map(page, name)
        assert await page.locator('#selection-map .map-selected').count() == 1
    # More detailed source data must not collapse Ogasawara into subpixel cells.
    island_area = await page.locator(
        '#selection-map .map-region[data-name="小笠原村"] polygon').evaluate_all(
        'els=>Math.max(...els.map(el=>{const b=el.getBoundingClientRect();return b.width*b.height}))')
    assert island_area >= 80, island_area
    flashes = await page.evaluate('selectionFlashes')
    assert flashes == 0 if reduced else flashes >= 3, flashes
    await page.locator('#selection-map').screenshot(path=f'/tmp/blade-islands-{width}.png')

    for name in AFFECTED:
        await open_prefecture(page, name)
        assert await page.locator('.map-inset-frame').count() >= 2, name
        await page.locator('#regions').get_by_role('button', name=f'{name}を選ぶ', exact=True).click()
        total = await page.locator('#selection-map .map-region').count()
        assert total > 1
        assert await page.locator('#selection-map .map-selected').count() == total, name
        assert await page.evaluate('''() => [...document.querySelectorAll('#selection-map polygon')]
            .every(el => [...el.points].every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))''')
    await national(page)
    await page.locator('#select-cpu').click()
    assert await page.locator('.map-inset-frame').count() == 0
    await page.locator('#title-back').click()
    await page.locator('#start-team').click()
    await page.locator('#select-player').click()
    while await page.locator('.team-slot:enabled').count():
        await page.locator('.team-slot:enabled').first.click()
    await open_prefecture(page, '東京都')
    for name in ['新宿区', '大島町', '小笠原村']:
        await select_map(page, name)
    assert await page.locator('.map-selection-label').count() == 3
    assert await page.locator('#selection-map .map-selected').count() == 3
    region = page.locator('#selection-map .map-region[data-name="大島町"]')
    await region.focus()
    await page.keyboard.press('Enter')
    assert 'map-selected' not in (await region.get_attribute('class'))
    assert '大島町' not in await page.locator('.map-selection-label').all_text_contents()
    assert await page.locator('.map-selection-label').count() == 2
    await page.locator('#select-cpu').click()
    await national(page)
    await open_prefecture(page, '東京都')
    assert await page.locator('.map-selection-label').count() == 0
    await select_map(page, '八丈町')
    assert await page.locator('.map-selection-label').all_text_contents() == ['八丈町']
    await national(page)
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    await page.close()
    print(f'{width}px reduced={reduced}: inset selection, whole prefecture, team toggle, CPU, national PASS')


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width in [1280, 390, 320]:
            await exercise(browser, width)
        await exercise(browser, 390, reduced=True)
        await browser.close()


asyncio.run(main())
