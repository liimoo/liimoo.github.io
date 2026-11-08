"""Battle HUD and canvas identify municipalities by prefecture."""
import asyncio
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, select_regions, start_battle

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width, height in [(1280, 900), (390, 844), (320, 568)]:
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.add_init_script('''window.drawnLabels = new Set();
const original = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
 window.drawnLabels.add(text); return original.call(this, text, ...args);
};''')
            await page.goto('http://127.0.0.1:8766/blade/')
            await enter_selection(page)
            await select_regions(page, 'player', '岩手県', ['岩手県'])
            await select_regions(page, 'cpu', '兵庫県', ['たつの市'])
            await start_battle(page)
            assert await page.locator('#cpu-prefecture').inner_text() == '兵庫県'
            assert await page.locator('#cpu-name').inner_text() == 'たつの市'
            assert await page.locator('#player-prefecture').is_hidden()
            assert await page.evaluate("drawnLabels.has('兵庫県') && drawnLabels.has('たつの市')")
            assert await page.locator('#cpu-prefecture').evaluate('(el) => el.scrollWidth <= el.clientWidth')
            await page.screenshot(path=f'/tmp/blade-prefecture-{width}.png')
            await page.close()
        await browser.close()
    print('Battle prefecture labels: desktop and two mobile widths passed')

asyncio.run(main())
