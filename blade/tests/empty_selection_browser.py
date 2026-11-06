"""Blank player, randomized valid CPU, start guard and explicit roster completion."""
import asyncio,sys
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width in [1280,320]:
   page=await browser.new_page(viewport={'width':width,'height':740})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/googletagmanager.com/**',lambda r:r.abort())
   await page.goto(BASE+'/blade/')
   for team in [False,True]:
    await page.locator('#start-team' if team else '#start-exhibition').click()
    assert await page.locator('#selected-region-detail h3').inner_text()=='未選択'
    assert await page.locator('#confirm-match').is_disabled()
    assert await page.locator('#regions [aria-pressed="true"]').count()==0
    await page.locator('#confirm-match').dispatch_event('click')
    assert await page.locator('#choose-region').is_visible()
    await page.locator('#select-cpu').click()
    assert '未選択' not in await page.locator('#opponent-name').inner_text()
    if team:assert await page.locator('.team-slot:enabled').count()==3
    await page.locator('#shuffle').click()
    await page.locator('#select-player').click()
    assert await page.locator('#selected-region-detail h3').inner_text()=='未選択'
    if team:assert await page.locator('.team-slot:enabled').count()==0
    await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
    for i,city in enumerate(['大阪市','堺市','岸和田市'] if team else ['大阪市']):
     await page.locator('#regions').get_by_role('button',name=city+'を選ぶ',exact=True).click()
     if team and i<2:assert await page.locator('#confirm-match').is_disabled()
    assert await page.locator('#confirm-match').is_enabled()
    await page.locator('#confirm-match').click();await page.locator('#vs-back').click()
    assert await page.locator('#confirm-match').is_enabled()
    await page.locator('#confirm-match').click();await page.locator('#skip-vs').click()
    assert await page.locator('#launch').is_enabled()
    await page.locator('#battle-back').click()
    assert await page.locator('#confirm-match').is_enabled()
    await page.locator('#title-back').click()
   # Starting another exhibition clears the player's previous choice.
   await page.locator('#start-exhibition').click()
   assert await page.locator('#selected-region-detail h3').inner_text()=='未選択'
   assert await page.locator('#confirm-match').is_disabled()
   assert not errors,errors
   await page.close()
  await browser.close()
 print('Empty selection: solo/team, CPU random roster, blocked start, explicit choice, back preservation, new game reset PASS')
asyncio.run(main())
