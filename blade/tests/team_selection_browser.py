"""Same-prefecture three-city selection and existing solo mode regression."""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width in [1280, 390, 320]:
            page = await browser.new_page(viewport={'width': width, 'height': 844})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.route('**/googletagmanager.com/**', lambda route: route.abort())
            await page.goto(BASE + '/blade/')
            await page.locator('#start-team').click()
            assert await page.locator('#team-roster').is_visible()
            assert await page.locator('.team-slot').count() == 3
            assert await page.locator('#confirm-match').is_enabled()
            assert await page.locator('#match-preview .preview-fighter').count() == 6
            await page.locator('.team-slot').first.click()
            assert await page.locator('#confirm-match').is_disabled()
            await page.locator('.prefecture-card[data-prefecture="千葉県"]').click()
            assert await page.locator('#regions').get_by_role('button', name='千葉県を選ぶ', exact=True).count() == 0
            cards = page.locator('#regions .region-card')
            await cards.nth(0).click()
            assert await page.locator('#regions [aria-pressed="true"]').count() == 1
            assert '1/3都市' in await page.locator('#team-selection-status').inner_text()
            await cards.nth(1).click()
            await cards.nth(2).click()
            assert await page.locator('#confirm-match').is_enabled()
            await cards.nth(3).click()
            assert await page.locator('#regions [aria-pressed="true"]').count() == 3
            await page.locator('#select-cpu').click()
            await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
            await page.locator('#regions .region-card').nth(0).click()
            assert await page.locator('#confirm-match').is_disabled()
            await page.locator('#regions .region-card').nth(1).click()
            await page.locator('#regions .region-card').nth(2).click()
            assert await page.locator('#confirm-match').is_enabled()
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.locator('#confirm-match').click()
            assert await page.locator('#vs-preview .preview-fighter').count() == 6
            await page.locator('#vs-back').click()
            await page.locator('#title-back').click()
            await page.locator('#start-exhibition').click()
            assert await page.locator('#team-roster').is_hidden()
            assert await page.locator('#match-preview .preview-fighter').count() == 2
            assert not errors, errors
            await page.close()
        await browser.close()
    print('team selection browser passed: 1280 / 390 / 320px')

asyncio.run(main())
