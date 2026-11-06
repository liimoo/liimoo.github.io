"""Impact-to-audio integration: friendly contacts stay silent without losing enemy cues."""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection

ROOT = Path(__file__).parents[1]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        audio = '''window.cues=[];let enabled=false;
export const createBladeAudio=()=>({stop(){},disable(){enabled=false},
async enable(){enabled=true;return true},
play(cue,options){if(enabled)window.cues.push({cue,options})}});'''
        app = (ROOT / 'app.mjs').read_text() + '''
window.impactProbe=(impacts,phase='active',solo=false)=>{
 const saved=match;
 const sides=solo?['player','cpu']:['player','player','player','cpu','cpu','cpu'];
 match={phase,impacts,bodies:sides.map((side,i)=>({side,region:{name:`地域${i}`}}))};
 collectImpacts();
 match=saved;
 const result={cues:window.cues.slice(),lastImpactId,flashes:criticalFlashes.length};
 criticalFlashes=[];
 return result;
};'''
        await page.route('**/audio.mjs*', lambda route: route.fulfill(content_type='text/javascript', body=audio))
        await page.route('**/app.mjs*', lambda route: route.fulfill(content_type='text/javascript', body=app))
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.goto('http://127.0.0.1:8766/blade/')
        await enter_selection(page)
        await page.evaluate('window.cues=[]')

        def impact(serial, participants, **kwargs):
            return {'id': serial, 'x': 0, 'y': 0, 'age': 0,
                    'participants': participants, 'criticalAttackers': [], **kwargs}

        async def collect(events, phase='active', solo=False):
            return await page.evaluate('([events,phase,solo])=>impactProbe(events,phase,solo)', [events, phase, solo])

        friendly = [impact(1, [0, 1], friendly=True), impact(2, [3, 4], friendly=True)]
        result = await collect(friendly)
        assert result['cues'] == [], f"Friendly collisions played damage cues: {result['cues']}"
        assert result['lastImpactId'] == 2, result
        assert result['flashes'] == 0, result

        mixed = friendly + [impact(3, [1, 3], friendly=False), impact(4, [0, 2], friendly=True)]
        result = await collect(mixed)
        assert result['cues'] == [{'cue': 'hit', 'options': {'decisive': False}}], result
        assert result['lastImpactId'] == 4, result
        assert (await collect(mixed))['cues'] == result['cues'], 'Repeated events replayed sound'

        result = await collect([impact(5, [0, 3], friendly=False, criticalAttackers=[0])])
        assert result['cues'][-1] == {'cue': 'critical', 'options': {'enemy': False, 'decisive': False}}, result
        assert result['flashes'] == 1, result
        result = await collect([impact(6, [1, 4], friendly=False, criticalAttackers=[4])])
        assert result['cues'][-1] == {'cue': 'critical', 'options': {'enemy': True, 'decisive': False}}, result

        result = await collect([impact(7, [0, 3], friendly=False)], 'finished')
        assert result['cues'][-1] == {'cue': 'hit', 'options': {'decisive': True}}, result
        result = await collect([impact(8, [0, 3], friendly=False, criticalAttackers=[0])], 'finished')
        assert result['cues'][-1] == {'cue': 'critical', 'options': {'enemy': False, 'decisive': True}}, result
        result = await collect([impact(9, [0, 1])], solo=True)
        assert result['cues'][-1] == {'cue': 'hit', 'options': {'decisive': False}}, result
        assert len(result['cues']) == 6, result
        assert result['lastImpactId'] == 9, result
        assert not errors, errors
        print('Friendly player/CPU silent; enemy normal/critical/decisive and solo audible; event deduplication PASS')
        await browser.close()


asyncio.run(main())
