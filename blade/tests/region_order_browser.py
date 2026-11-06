"""Sorting preserves selected regions and team roster on all viewport sizes."""
import asyncio,sys
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width in [1280,390,320]:
   page=await browser.new_page(viewport={'width':width,'height':844})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/googletagmanager.com/**',lambda r:r.abort())
   await page.goto(BASE+'/blade/');await page.locator('#start-exhibition').click()
   selected=await page.locator('#selected-region-detail h3').inner_text()
   for value,first in [('north','北海道'),('south','沖縄県'),('kana','愛知県')]:
    await page.locator('#region-order').select_option(value)
    assert await page.locator('.prefecture-card').first.get_attribute('data-prefecture')==first
    assert await page.locator('#selected-region-detail h3').inner_text()==selected
   await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
   for value in ['north','south','kana']:
    await page.locator('#region-order').select_option(value)
    assert await page.locator('#regions .region-card strong').first.inner_text()=='大阪府'
    assert await page.locator('#selected-region-detail h3').inner_text()==selected
   await page.locator('#region-search').fill('堺')
   await page.locator('#region-order').select_option('north')
   assert await page.locator('#region-search').input_value()=='堺'
   assert await page.locator('#regions .region-card:visible').count()==1
   await page.locator('#regions .region-card:visible').click()
   assert await page.locator('#selected-region-detail h3').inner_text()=='堺市'
   await page.locator('#select-cpu').click()
   assert await page.locator('#region-order').input_value()=='north'
   await page.locator('#title-back').click();await page.locator('#start-team').click()
   roster=await page.locator('#team-roster').inner_text()
   await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
   await page.locator('#region-order').select_option('south')
   assert await page.locator('#team-roster').inner_text()==roster
   assert await page.locator('#regions .region-card strong').first.inner_text()!='大阪府'
   assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
   if width==390:await page.screenshot(path='/tmp/blade-region-order.png')
   assert not errors,errors
   await page.close()
  await browser.close()
 print('Region ordering: desktop/mobile, north/south/kana, selection, search, team roster PASS')
asyncio.run(main())
