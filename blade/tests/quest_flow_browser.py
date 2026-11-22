"""Quest mode browser smoke test. Run against an HTTP server with Playwright installed."""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.goto(BASE + '/blade/')
        await page.wait_for_function('!document.getElementById("start-quest").disabled')
        await page.locator('#start-quest').click()
        await page.locator('#quest-screen').get_by_role('button', name='新しく始める').click()
        assert await page.locator('.quest-member').count() == 5
        assert '合計100ポイント' in await page.locator('#quest-screen').inner_text()
        await page.locator('#quest-screen').get_by_role('button', name='クエスト開始').click()
        assert '第1戦' in await page.locator('#quest-screen').inner_text()
        await page.locator('#quest-screen').get_by_role('button', name='対戦相手を確認').click()
        assert '対戦相手' in await page.locator('#quest-screen').inner_text()
        await page.locator('#quest-screen').get_by_role('button', name='仲間を選ぶ').click()
        for checkbox in await page.locator('.quest-select-member input').all()[:3]:
            await checkbox.check()
        await page.locator('#quest-screen').get_by_role('button', name='出撃').click()
        assert await page.locator('#battle').is_visible()
        assert await page.locator('#player-roster .battle-member').count() == 3
        await page.locator('#launch').click()
        await page.wait_for_function('document.getElementById("status").textContent.includes("発射後")')
        assert not errors, errors
        await browser.close()
        print('Quest: initial bonus, stage flow, team selection, battle launch PASS')

asyncio.run(main())
