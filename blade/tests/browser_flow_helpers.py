"""User-driven screen navigation shared by browser regression checks."""
async def enter_selection(page):
    await page.locator('#start-exhibition').click()
    await page.locator('#choose-region').wait_for()
    await page.locator('.prefecture-card').last.wait_for(state='attached')

async def select_regions(page, side, prefecture, names, *, team=False):
    """Select a reproducible fixture through UI without relying on startup defaults."""
    await page.locator(f'#select-{side}').click()
    if team:
        while await page.locator('.team-slot:enabled').count():
            await page.locator('.team-slot:enabled').first.click()
    if await page.locator('#prefecture-back').is_visible():
        await page.locator('#prefecture-back').click()
    await page.locator(f'.prefecture-card[data-prefecture="{prefecture}"]').click()
    for name in names:
        await page.locator('#regions').get_by_role('button', name=f'{name}を選ぶ', exact=True).click()
    await page.locator('#prefecture-back').click()

async def select_solo_match(page):
    await select_regions(page, 'player', '大阪府', ['大阪市'])
    await select_regions(page, 'cpu', '北海道', ['北海道'])
    await page.locator('#select-player').click()

async def select_team_match(page):
    await select_regions(page, 'player', '大阪府', ['大阪市', '堺市', '岸和田市'], team=True)
    await select_regions(page, 'cpu', '北海道', ['札幌市', '函館市', '小樽市'], team=True)
    await page.locator('#select-player').click()

async def start_battle(page):
    await page.locator('#confirm-match').click()
    await page.locator('#skip-vs').click()
    await page.locator('#battle').wait_for()

async def replay_battle(page):
    await page.locator('#again').click()
    await page.locator('#skip-vs').click()
    await page.locator('#battle').wait_for()
