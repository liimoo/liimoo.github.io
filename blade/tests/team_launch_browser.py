"""Independent city controls and explicit arena launch; no drag launch in team mode."""
import asyncio,sys
from pathlib import Path
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width in [1280,390,320]:
   page=await browser.new_page(viewport={'width':width,'height':900})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/googletagmanager.com/**',lambda r:r.abort())
   await page.goto(BASE+'/blade/')
   await page.locator('#start-team').click();await page.locator('#confirm-match').click();await page.locator('#skip-vs').click()
   assert await page.locator('.arena-wrap #launch').count()==1
   assert await page.locator('#player-energy').is_hidden()
   assert await page.locator('#cpu-energy').is_hidden()
   assert await page.locator('.battle-member .energy:visible').count()==6
   assert await page.locator('#stage-controls #angle').is_visible()
   assert await page.locator('#stage-controls #power').is_visible()
   panel=await page.locator('#stage-controls').bounding_box();button=await page.locator('#launch').bounding_box()
   assert button['x']>panel['x']+panel['width']/2
   assert button['y']>panel['y']+panel['height']/3
   for i,(angle,power) in enumerate([(-40,30),(0,70),(50,100)]):
    await page.locator(f'#launch-cities button[data-city="{i}"]').click()
    await page.locator('#angle').fill(str(angle));await page.locator('#power').fill(str(power))
   await page.locator('#launch-cities button[data-city="0"]').click()
   assert await page.locator('#angle').input_value()=='-40'
   assert await page.locator('#power').input_value()=='30'
   await page.locator('#arena').scroll_into_view_if_needed()
   r=await page.locator('#arena').bounding_box();x=r['x']+r['width']*(148/440);y=r['y']+r['height']*(315/440)
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+25);await page.mouse.up()
   await page.wait_for_timeout(150)
   assert await page.locator('#launch').is_visible()
   assert await page.locator('#pause').is_disabled()
   assert await page.locator('#time').inner_text()=='45'
   assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
   if width==390:await page.screenshot(path='/tmp/blade-individual-launch.png')
   r=await page.locator('#launch').bounding_box()
   await page.mouse.move(r['x']+5,r['y']+r['height']/2);await page.mouse.down()
   pressed=await page.locator('#launch').bounding_box()
   assert abs(pressed['x']-r['x'])<1
   await page.mouse.up()
   assert await page.locator('#launch').is_hidden()
   assert await page.locator('#pause').is_enabled()
   assert await page.locator('#launch-cities button:disabled').count()==3
   await page.locator('#result').wait_for(timeout=35000)
   await page.locator('#again').click();await page.locator('#skip-vs').click()
   assert await page.locator('#launch').is_visible()
   assert await page.locator('#angle').input_value()=='0'
   await page.locator('#battle-back').click();await page.locator('#title-back').click();await page.locator('#start-exhibition').click()
   await page.locator('#confirm-match').click();await page.locator('#skip-vs').click()
   assert await page.locator('.launch-controls #launch').count()==1
   assert await page.locator('#launch-cities').is_hidden()
   assert await page.locator('#player-energy').is_visible()
   assert await page.locator('#cpu-energy').is_visible()
   assert not errors,errors
   await page.close()
  await browser.close()
 print('Individual team launch: 1280/390/320, independent values, drag prevention, arena button, replay and solo PASS')
asyncio.run(main())
