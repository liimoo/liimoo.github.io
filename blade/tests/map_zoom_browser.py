"""Prefecture camera zoom, back navigation, cancellation and reduced motion."""
import asyncio,sys
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width in [1280,390]:
   page=await browser.new_page(viewport={'width':width,'height':844})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/googletagmanager.com/**',lambda r:r.abort())
   await page.goto(BASE+'/blade/');await page.locator('#start-exhibition').click()
   await page.locator('#selection-map g[data-name="大阪府"]').wait_for()
   original=await page.locator('#selection-map').get_attribute('viewBox')
   await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
   assert await page.locator('#selection-map').get_attribute('aria-busy')=='true'
   await page.wait_for_timeout(180)
   intermediate=await page.locator('#selection-map').get_attribute('viewBox')
   assert float(intermediate.split()[2])<float(original.split()[2])
   await page.wait_for_function("document.querySelector('#selection-map').getAttribute('aria-busy')!=='true'")
   await page.locator('#selection-map g[data-name="大阪市"]').wait_for()
   await page.locator('#prefecture-back').click()
   assert await page.locator('#selection-map').get_attribute('aria-busy')=='true'
   await page.wait_for_function("document.querySelector('#selection-map').getAttribute('aria-busy')!=='true'")
   assert await page.locator('#selection-map').get_attribute('viewBox')==original
   # The same camera is used for map activation, including keyboard users.
   await page.locator('#selection-map g[data-name="北海道"]').focus()
   await page.keyboard.press('Enter')
   assert await page.locator('#selection-map').get_attribute('aria-busy')=='true'
   await page.locator('#prefecture-back').click()
   await page.wait_for_function("document.querySelector('#selection-map').getAttribute('aria-busy')!=='true'")
   assert await page.locator('#picker-title').inner_text()=='全国'
   await page.emulate_media(reduced_motion='reduce')
   await page.locator('.prefecture-card[data-prefecture="大阪府"]').click()
   assert await page.locator('#selection-map').get_attribute('aria-busy')!='true'
   await page.locator('#selection-map g[data-name="大阪市"]').wait_for()
   assert not errors,errors
   await page.close()
  await browser.close()
 print('Map zoom: desktop/mobile, list/map, reverse, cancellation, reduced motion PASS')
asyncio.run(main())
