"""Critical presentation/audio integration, with deterministic browser-only engine events."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, start_battle, replay_battle, select_solo_match
ROOT=Path(__file__).parents[1]
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        for terminal,reduced in [(False,False),(True,False),(True,True)]:
            page=await browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce' if reduced else 'no-preference')
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            source=(ROOT/'engine.mjs').read_text().replace('export function step(match,dt)','function actualStep(match,dt)')
            source+='''\nexport function step(match,dt){
 const next={...match,elapsed:match.elapsed+dt,impacts:match.impacts.map(p=>({...p,age:p.age+dt}))};
 if(match.elapsed===0)return {...next,impacts:[{id:1,x:0,y:0,age:0,critical:true,criticalAttackers:[0]}],'''+('''phase:'finished',result:{winner:'player',reason:'spin'},bodies:next.bodies.map((b,i)=>i?{...b,energy:0,spin:0}:b)''' if terminal else "phase:'active'")+'''};
 return next;
}\n'''
            audio="""window.cues=[];let enabled=false;export const createBladeAudio=()=>({stop(){},disable(){enabled=false},async enable(){enabled=true;return true},play(cue,options){if(enabled)window.cues.push({cue,options})}});"""
            app=(ROOT/'app.mjs').read_text()+"\nwindow.criticalProbe=()=>criticalFlashes.map(f=>({...f}));"
            await page.route('**/engine.mjs*',lambda r:r.fulfill(content_type='text/javascript',body=source))
            await page.route('**/audio.mjs*',lambda r:r.fulfill(content_type='text/javascript',body=audio))
            await page.route('**/app.mjs*',lambda r:r.fulfill(content_type='text/javascript',body=app))
            await page.route('**/googletagmanager.com/**',lambda r:r.abort())
            # Force several physics substeps per frame: events must not be lost.
            await page.add_init_script('const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(performance.now()),65));')
            await page.add_init_script("window.criticalLabels=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(['会心の一撃！','痛恨の一撃！'].includes(text))window.criticalLabels.push({text,args,time:performance.now()});return original.call(this,text,...args);};")
            await page.goto('http://127.0.0.1:8766/blade/')
            await enter_selection(page)
            await select_solo_match(page)
            await start_battle(page)
            assert await page.locator('#sound').get_attribute('aria-pressed') == 'true'
            await page.locator('#launch').click()
            await page.wait_for_function('criticalProbe().length===1')
            assert await page.evaluate("cues.filter(x=>x.cue==='critical').length")==1
            assert await page.evaluate("cues.filter(x=>x.cue==='hit').length")==0
            await page.wait_for_function('criticalLabels.length>0')
            if not terminal:
                await page.locator('#pause').click()
                age=await page.evaluate('criticalProbe()[0].age')
                await page.wait_for_timeout(400)
                assert await page.evaluate('criticalProbe()[0].age')==age
                await page.locator('#resume').click()
            await page.wait_for_timeout(800)
            assert await page.evaluate('criticalProbe().length')==0
            if reduced:
                positions=await page.evaluate('criticalLabels.map(label=>JSON.stringify(label.args))')
                assert len(set(positions))==1, positions
            label_count=await page.evaluate('criticalLabels.length')
            await page.wait_for_timeout(100)
            assert await page.evaluate('criticalLabels.length')==label_count
            assert await page.evaluate("cues.filter(x=>x.cue==='critical').length")==1
            if terminal:
                await page.wait_for_function('!document.getElementById("result").hidden')
                await replay_battle(page)
                assert await page.evaluate('criticalProbe().length')==0
                await page.locator('#sound').click()
                label_count=await page.evaluate('criticalLabels.length')
                await page.locator('#launch').click()
                await page.wait_for_timeout(200)
                assert await page.evaluate('criticalLabels.length')>label_count
                assert await page.evaluate("cues.filter(x=>x.cue==='critical').length")==1
            assert not errors,errors
            print(f'critical final={terminal} reduced={reduced}: substep cue, flash expiry, pause/replay/mute PASS')
            await page.close()
        await browser.close()
asyncio.run(main())
