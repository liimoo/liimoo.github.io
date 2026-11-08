"""Share payloads and fallback UI, without sending a social post."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, select_solo_match, select_team_match, start_battle

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for mode in ['single','team','pref-team']:
   for width,height in [(1280,900),(320,568),(844,390)]:
    page=await browser.new_page(viewport={'width':width,'height':height})
    source=(Path(__file__).parents[1]/'app.mjs').read_text()+"\nwindow.finishProbe=()=>{match={...match,phase:'finished',result:{winner:'player',reason:'spin'}};finished();};"
    await page.route('**/app.mjs*',lambda r:r.fulfill(content_type='text/javascript',body=source))
    await page.add_init_script('''window.shared=[];window.copied=[];
Object.defineProperty(navigator,'share',{configurable:true,value:async data=>shared.push(data)});
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copied.push(text)}});''')
    await page.goto('http://127.0.0.1:8766/blade/')
    if mode=='single':
     await enter_selection(page);await select_solo_match(page)
    elif mode=='team':
     await page.locator('#start-team').click();await select_team_match(page)
    else:
     await page.locator('#start-pref-team').click()
     for name in ['北海道','東京都','大阪府']:
      await page.locator(f'.prefecture-card[data-prefecture="{name}"]').click()
    await start_battle(page);await page.evaluate('finishProbe()')
    assert (await page.locator('#share-x').get_attribute('href')).startswith('https://x.com/intent/tweet?')
    await page.locator('#share').click();await page.locator('#share-copy').click()
    assert await page.evaluate("shared.length===1 && copied[0]===shared[0].text+'\\n'+shared[0].url")
    await page.screenshot(path=f'/tmp/blade-share-before-{mode}-{width}.png')
    for selector in ['#share-x','#share','#share-copy','#again','#reselect']:
     box=await page.locator(selector).bounding_box()
     assert box and 0<=box['x'] and box['x']+box['width']<=width and 0<=box['y'] and box['y']+box['height']<=height,(mode,width,selector,box)
    await page.evaluate("() => {document.getElementById('share-status').textContent='';Object.defineProperty(navigator,'share',{value:async()=>{throw new DOMException('cancel','AbortError')}});}")
    await page.locator('#share').click();assert await page.locator('#share-status').inner_text()==''
    await page.evaluate("Object.defineProperty(navigator,'share',{value:undefined});")
    await page.locator('#share').click();assert await page.evaluate('copied.length')==2
    await page.evaluate("() => {navigator.clipboard.writeText=async()=>{throw new Error('denied')};}")
    await page.locator('#share-copy').click();assert await page.locator('#share-fallback').is_visible()
    assert 'https://japan-map.app/blade/' in await page.locator('#share-fallback').input_value()
    await page.screenshot(path=f'/tmp/blade-share-{mode}-{width}.png')
    await page.locator('#again').click();await page.locator('#skip-vs').click()
    assert await page.locator('#share-fallback').is_hidden()
    await page.close()
  await browser.close()
 print('Share: three modes × desktop/mobile/landscape, native payload, X link, copy and denied fallback PASS')
asyncio.run(main())
