"""Four-second face-off and safe screen-tap skipping in all exhibition modes."""
import asyncio
import time
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, select_solo_match, select_team_match


async def prepare(page, mode):
    await page.route('**/googletagmanager.com/**', lambda route: route.abort())
    await page.route('**/functions/v1/blade-telemetry', lambda route: route.fulfill(
        status=200, content_type='application/json', body='{"success":true}'))
    await page.goto('http://127.0.0.1:8766/blade/')
    if mode == 'single':
        await enter_selection(page)
        await select_solo_match(page)
    elif mode == 'team':
        await page.locator('#start-team').click()
        await select_team_match(page)
    else:
        await page.locator('#start-pref-team').click()
        for name in ['北海道', '東京都', '大阪府']:
            await page.locator(f'.prefecture-card[data-prefecture="{name}"]').click()


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        for mode, reduced in [('single', False), ('team', False),
                              ('pref-team', False), ('single', True)]:
            page = await browser.new_page(
                viewport={'width': 390, 'height': 844},
                reduced_motion='reduce' if reduced else 'no-preference')
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await prepare(page, mode)
            await page.locator('#confirm-match').click()
            began = time.monotonic()
            await page.wait_for_timeout(1800)
            assert await page.locator('#vs-screen').is_visible(), 'VS ended before four seconds'
            await page.locator('#battle').wait_for(timeout=4000)
            elapsed = time.monotonic() - began
            assert 3.7 <= elapsed <= 5.5, elapsed
            assert await page.locator('#launch').is_enabled()
            assert not errors, errors
            print(f'{mode} reduced={reduced}: four-second automatic transition PASS', flush=True)
            await page.close()

        page = await browser.new_page(viewport={'width': 390, 'height': 844})
        await prepare(page, 'single')
        # The back button must not bubble into the screen-wide skip handler.
        await page.locator('#confirm-match').click()
        await page.locator('#vs-back').click()
        await page.wait_for_timeout(4200)
        assert await page.locator('#choose-region').is_visible()
        assert not await page.locator('#battle').is_visible()
        # Clicking the heading is a genuine background-area screen click.
        await page.locator('#confirm-match').click()
        await page.locator('#vs-heading').click(force=True)
        await page.locator('#battle').wait_for(timeout=1000)
        # No stale VS timer may reset an already launched battle.
        await page.locator('#launch').click()
        await page.wait_for_timeout(4200)
        assert not await page.locator('#launch').is_visible()
        await page.close()
        page = await browser.new_page(viewport={'width': 390, 'height': 844})
        await prepare(page, 'single')
        await page.locator('#confirm-match').click()
        await page.locator('#vs-preview svg').first.click(force=True)
        await page.locator('#battle').wait_for(timeout=1000)
        assert await page.locator('#launch').is_enabled()
        await page.locator('#battle-back').click()
        await page.locator('#confirm-match').click()
        await page.locator('#skip-vs').click()
        await page.locator('#battle').wait_for(timeout=1000)
        assert await page.locator('#launch').is_enabled()
        print('Back cancellation, heading/map tap and explicit skip: PASS', flush=True)
        await browser.close()


asyncio.run(main())
