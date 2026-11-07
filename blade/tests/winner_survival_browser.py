"""Final simultaneous knockout preserves the tiebreak winner in canvas and HUD."""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import select_team_match
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8766'
PROBE='''
window.forceFinal=(winner)=>{
 const kept=winner==='player'?2:5;
 match=launch(match,{x:0,y:-1},.75);
 match={...match,bodies:match.bodies.map((b,i)=>({...b,energy:i===2||i===5?1:0,rawEnergy:0}))};
 match=step(match,1/120);teamEffects=collectTeamEffects(teamEffects,match,reduced);
 match={...match,bodies:match.bodies.map((b,i)=>i===2||i===5?{...b,energy:0,rawEnergy:i===kept?-.1:-.2}:b)};
 const before=match.bodies;match=step(match,1/120);teamEffects=collectTeamEffects(teamEffects,match,reduced);
 beginFinish(before);updateHud();
};
window.survivalProbe=()=>({result:match.result,visible:match.bodies.flatMap((b,i)=>teamHidden(teamEffects,i)?[]:[i]),effects:teamEffects.effects.map(e=>e.losers),hp:match.bodies.map(b=>b.energy)});
'''
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for reduced in [False,True]:
   for winner in ['player','cpu']:
    page=await browser.new_page(viewport={'width':900,'height':1100},reduced_motion='reduce' if reduced else 'no-preference')
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    source=(Path(__file__).parents[1]/'app.mjs').read_text()+PROBE
    await page.route('**/app.mjs*',lambda route:route.fulfill(content_type='text/javascript',body=source))
    await page.route('**/googletagmanager.com/**',lambda route:route.abort())
    await page.route('**/functions/v1/blade-telemetry',lambda route:route.fulfill(status=200,content_type='application/json',body='{"ok":true}'))
    await page.goto(BASE+'/blade/')
    await page.locator('#start-team').click()
    await select_team_match(page)
    await page.locator('#confirm-match').click()
    if not reduced: await page.locator('#skip-vs').click()
    await page.locator('#battle').wait_for()
    await page.evaluate('(winner)=>forceFinal(winner)',winner)
    await page.locator('#result').wait_for()
    await page.wait_for_timeout(300)
    state=await page.evaluate('survivalProbe()')
    kept=2 if winner=='player' else 5
    assert state['result']['winner']==winner,state
    assert '同時にスタミナ切れ' in await page.locator('#result-detail').inner_text()
    assert state['visible']==[kept],state
    assert state['hp'][kept]==0,state
    assert await page.locator('.battle-member.eliminated').count()==5
    assert '残り0％' in await page.locator(f'.battle-member[data-body="{kept}"]').get_attribute('aria-label')
    if not reduced: await page.screenshot(path=f'/tmp/blade-winner-survival-{winner}.png')
    assert not errors,errors
    await page.close()
  await browser.close()
 print('winner survival browser passed: both winners, zero HP, only loser breaks, prior losses stay hidden, HUD, reduced motion')
asyncio.run(main())
