"""Deterministic player/enemy/both presentation and exact defender HUD checks."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import select_solo_match, select_team_match
ROOT=Path(__file__).parents[1]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for team,attackers,reduced in [(False,[1],False),(False,[0,1],False),(True,[1,5],False),(True,[5],True)]:
   pair=[1,5] if team else [0,1]
   page=await browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce' if reduced else 'no-preference')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   source=(ROOT/'engine.mjs').read_text().replace('export function step(match,dt)','function actualStep(match,dt)')
   source+='\nexport function step(match,dt){return {...match,elapsed:match.elapsed+dt,impacts:match.elapsed===0?[{id:1,x:0,y:0,age:0,critical:true,participants:'+json.dumps(pair)+',criticalAttackers:'+json.dumps(attackers)+'}]:[]};}'
   audio="window.cues=[];export const createBladeAudio=()=>({stop(){},disable(){},async enable(){return true},play(cue,options){window.cues.push({cue,options})}});"
   await page.route('**/engine.mjs*',lambda r:r.fulfill(content_type='text/javascript',body=source))
   await page.route('**/audio.mjs*',lambda r:r.fulfill(content_type='text/javascript',body=audio))
   await page.route('**/googletagmanager.com/**',lambda r:r.abort())
   await page.add_init_script("window.labels=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){window.labels.push({text:t,color:this.fillStyle,y:this.getTransform().f});return fill.call(this,t,...a);};")
   await page.goto('http://127.0.0.1:8766/blade/')
   await page.locator('#start-team' if team else '#start-exhibition').click()
   await (select_team_match(page) if team else select_solo_match(page))
   await page.locator('#confirm-match').click();await page.locator('#skip-vs').click()
   await page.locator('#launch').click()
   await page.wait_for_function("labels.some(l=>l.text==='痛恨の一撃！')")
   await page.locator('#pause').click()
   events=await page.evaluate("labels.filter(l=>['会心の一撃！','痛恨の一撃！'].includes(l.text))")
   has_player=any(i<(3 if team else 1) for i in attackers)
   assert any(e['text']=='会心の一撃！' for e in events)==has_player
   assert any(e['text']=='痛恨の一撃！' and e['color']=='#ff8768' for e in events)
   if has_player:
    ally=next(e for e in events if e['text']=='会心の一撃！');enemy=next(e for e in events if e['text']=='痛恨の一撃！')
    assert ally['color']=='#91fff0' and abs(ally['y']-enemy['y'])>10
   expected=[pair[1] if i==pair[0] else pair[0] for i in attackers]
   if team:
    actual=await page.locator('.battle-member:has([data-critical])').evaluate_all('(nodes)=>nodes.map(n=>Number(n.dataset.body))')
    assert sorted(actual)==sorted(expected),(actual,expected)
    assert await page.evaluate("labels.some(l=>l.text.endsWith('の攻撃'))")
   else:
    assert await page.locator('#player-energy').evaluate("n=>n.parentElement.dataset.critical")=='enemy'
    assert await page.locator('#cpu-energy').evaluate("n=>n.parentElement.dataset.critical||''")==('player' if has_player else '')
   cues=await page.evaluate("cues.filter(c=>c.cue==='critical').map(c=>c.options.enemy)")
   assert sorted(cues)==([False,True] if has_player else [True])
   if team and has_player:await page.locator('#resume').click();await page.screenshot(path='/tmp/blade-critical-sides.png')
   else:await page.locator('#resume').click()
   await page.wait_for_timeout(800)
   assert await page.locator('[data-critical]').count()==0
   assert not errors,errors
   await page.close()
  await browser.close()
 print('Critical sides: enemy/both, solo/team, exact defender, cue pitch selection, reduced motion, expiry PASS')
asyncio.run(main())
