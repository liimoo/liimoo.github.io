"""Exercise actual six-body physics, individual knockout rendering and replay."""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import select_team_match
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for reduced in [False,True]:
   page=await browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce' if reduced else 'no-preference')
   errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   source=(Path(__file__).parents[1]/'app.mjs').read_text()+'''\nwindow.probe=()=>({phase:match?.phase,bodies:match?.bodies,events:match?.eliminations,effects:teamEffects,paused,result:match?.result});'''
   await page.route('**/app.mjs*',lambda route:route.fulfill(content_type='text/javascript',body=source))
   await page.route('**/googletagmanager.com/**',lambda route:route.abort())
   await page.goto(BASE+'/blade/')
   await page.locator('#start-team').click()
   await select_team_match(page)
   await page.locator('#confirm-match').click()
   if not reduced: await page.locator('#skip-vs').click()
   await page.locator('#battle').wait_for()
   assert await page.locator('.battle-member').count()==6
   assert await page.evaluate('probe().bodies.length')==6
   await page.locator('#launch').click()
   await page.wait_for_function("probe().events.length>0")
   assert await page.evaluate("probe().phase==='active'")
   assert await page.locator('#result').is_hidden()
   before=await page.evaluate('probe().bodies.filter(b=>!b.eliminated).map(b=>b.angle)')
   await page.locator('#pause').click()
   await page.wait_for_timeout(200)
   after=await page.evaluate('probe().bodies.filter(b=>!b.eliminated).map(b=>b.angle)')
   await page.wait_for_timeout(200)
   assert after==await page.evaluate('probe().bodies.filter(b=>!b.eliminated).map(b=>b.angle)')
   await page.locator('#resume').click()
   await page.locator('#result').wait_for(timeout=35000)
   assert await page.evaluate("probe().events.length>=3")
   assert await page.evaluate("probe().effects.effects.every(e=>e.done)")
   assert await page.locator('.battle-member.eliminated').count()>=3
   assert '大阪府' in await page.locator('#result-detail').inner_text()
   if not reduced: await page.screenshot(path='/tmp/blade-team-result.png')
   await page.locator('#again').click()
   if not reduced: await page.locator('#skip-vs').click()
   await page.locator('#battle').wait_for()
   assert await page.evaluate("probe().phase==='ready' && probe().events.length===0")
   assert await page.locator('.battle-member.eliminated').count()==0
   assert not errors,errors
   await page.close()
  await browser.close()
 print('team battle browser passed: six bodies, individual knockout, pause, result, replay, reduced motion')
asyncio.run(main())
