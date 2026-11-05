"""Independent city controls and explicit arena launch; no drag launch in team mode."""
import asyncio,sys
from pathlib import Path
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width,height in [(1280,900),(390,844),(320,568)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
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
   arena=await page.locator('#arena').bounding_box()
   assert panel['y']>=arena['y'] and panel['y']+panel['height']<=arena['y']+arena['height']+1
   assert button['y']+button['height']<=height
   assert await page.locator('#launch-cities').is_hidden()
   async def choose_city(i):
    point=await page.evaluate("async i=>{const m=await import('/blade/depth-view.mjs');return m.projectPoint({x:(i-1)*72,y:95},10*m.VIEW_TILT)}",i)
    box=await page.locator('#arena').bounding_box()
    await page.mouse.click(box['x']+box['width']*(220+point['x'])/440,box['y']+box['height']*(220+point['y'])/440)
   for i,(angle,power) in enumerate([(-40,30),(0,70),(50,100)]):
    await choose_city(i)
    await page.locator('#angle').fill(str(angle));await page.locator('#power').fill(str(power))
   await choose_city(0)
   assert await page.locator('#angle').input_value()=='-40'
   assert await page.locator('#power').input_value()=='30'
   await page.locator('#arena').scroll_into_view_if_needed()
   center=await page.evaluate("async()=>{const m=await import('/blade/depth-view.mjs');return m.projectPoint({x:-72,y:95})}")
   r=await page.locator('#arena').bounding_box();x=r['x']+r['width']*((220+center['x'])/440);y=r['y']+r['height']*((220+center['y'])/440)
   end=await page.evaluate("async()=>{const m=await import('/blade/depth-view.mjs');return m.projectPoint({x:-92,y:125})}")
   end_x=r['x']+r['width']*((220+end['x'])/440);end_y=r['y']+r['height']*((220+end['y'])/440)
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(end_x,end_y);await page.mouse.up()
   assert abs(int(await page.locator('#angle').input_value())-34)<=1
   await choose_city(2)
   assert await page.locator('#angle').input_value()=='50'
   assert await page.locator('#power').input_value()=='100'
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
   assert await page.locator('#stage-controls').is_hidden()
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
