"""All selection actions stay inside viewport; only the region list scrolls."""
import asyncio,sys
from playwright.async_api import async_playwright
from browser_flow_helpers import select_team_match
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def visible_inside(page,selector):
 box=await page.locator(selector).bounding_box();size=page.viewport_size
 assert box and box['y']>=-1 and box['x']>=-1 and box['y']+box['height']<=size['height']+1 and box['x']+box['width']<=size['width']+1,(selector,box,size)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width,height in [(1280,800),(390,844),(320,568),(844,390)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/googletagmanager.com/**',lambda r:r.abort())
   await page.goto(BASE+'/blade/');await page.locator('#start-team').click()
   await select_team_match(page)
   for selector in ['#title-back','#select-player','#select-cpu','#team-roster','#shuffle','#confirm-match','.map-picker']:
    await visible_inside(page,selector)
   scroll=await page.evaluate('scrollY')
   await page.locator('.prefecture-card[data-prefecture="沖縄県"]').click()
   await visible_inside(page,'#prefecture-back');await visible_inside(page,'#region-search');await visible_inside(page,'#confirm-match')
   assert await page.evaluate('scrollY')==scroll
   await page.locator('.picker-sidebar').evaluate('(el)=>el.scrollTop=el.scrollHeight')
   await visible_inside(page,'#prefecture-back')
   await page.locator('#prefecture-back').click()
   await page.locator('#select-cpu').click();await visible_inside(page,'#confirm-match')
   await page.locator('#selection-info > summary').click();await visible_inside(page,'#selection-info')
   await page.wait_for_function('document.querySelector(".map-picker").inert')
   await page.locator('#selection-info > summary').press('Escape')
   await page.wait_for_function('!document.querySelector(".map-picker").inert')
   await page.locator('#confirm-match').click();await page.locator('#vs-back').click()
   assert await page.locator('#choose-region').is_visible()
   if width==390:await page.screenshot(path='/tmp/blade-selection-viewport.png')
   await page.locator('#title-back').click();await page.locator('#start-exhibition').click()
   for selector in ['#select-player','#select-cpu','#shuffle','#confirm-match','.map-picker']:await visible_inside(page,selector)
   assert not errors,errors
   await page.close()
  await browser.close()
 print('Viewport selection: desktop, mobile, short screen, landscape, list scroll, details, back and solo PASS')
asyncio.run(main())
