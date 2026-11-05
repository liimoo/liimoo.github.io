"""User-driven screen navigation shared by browser regression checks."""
async def enter_selection(page):
    await page.locator('#start-exhibition').click()
    await page.locator('#choose-region').wait_for()
    await page.locator('.region-card').last.wait_for(state='attached')

async def start_battle(page):
    await page.locator('#confirm-match').click()
    await page.locator('#skip-vs').click()
    await page.locator('#battle').wait_for()

async def replay_battle(page):
    await page.locator('#again').click()
    await page.locator('#skip-vs').click()
    await page.locator('#battle').wait_for()
