"""Real UI launch integration; all telemetry HTTP is intercepted, never stored live."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, select_solo_match, select_team_match, start_battle, replay_battle
ROOT = Path(__file__).parents[1]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for mode in ['single', 'team', 'pref-team']:
            page = await browser.new_page()
            errors, requests = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            source = (ROOT / 'app.mjs').read_text() + '''
window.statsProbe={expected:()=>({mode,player_regions:match.bodies.filter(b=>b.side==='player').map(b=>b.region.id),cpu_regions:match.bodies.filter(b=>b.side==='cpu').map(b=>b.region.id)}),
finish:()=>{for(let i=0;i<10000&&match.phase==='active';i++)match=step(match,1/120);finished();finished();return {...match.result,duration:Math.round(match.elapsed)};}};'''
            await page.route('**/app.mjs*', lambda route: route.fulfill(content_type='text/javascript', body=source))
            await page.route('**/googletagmanager.com/**', lambda route: route.abort())
            async def telemetry(route):
                requests.append(route.request.post_data_json)
                if requests[-1]['event'] == 'start':
                    await asyncio.sleep(.2)
                await route.fulfill(status=200, content_type='application/json', body='{"ok":true}', headers={'Access-Control-Allow-Origin':'*'})
            await page.route('**/functions/v1/blade-telemetry', telemetry)
            await page.goto('http://127.0.0.1:8766/blade/')
            assert not requests
            if mode == 'single':
                await enter_selection(page)
                await select_solo_match(page)
            elif mode == 'team':
                await page.locator('#start-team').click()
                await select_team_match(page)
            else:
                await page.locator('#start-pref-team').click()
                for name in ['北海道','東京都','大阪府']:
                    await page.locator(f'.prefecture-card[data-prefecture="{name}"]').click()
            await start_battle(page)
            assert not requests, 'Selection / VS / preparation must not count'
            expected = await page.evaluate('statsProbe.expected()')
            await page.locator('#launch').click()
            result = await page.evaluate('statsProbe.finish()')
            await page.wait_for_timeout(500)
            assert len(requests) == 2, requests
            start, finish = requests
            assert {k:start[k] for k in expected} == expected, (start, expected)
            assert len(start['player_regions']) == (1 if mode == 'single' else 3)
            assert len(start['cpu_regions']) == (1 if mode == 'single' else 3)
            assert start['match_id'] == finish['match_id']
            assert {k:finish[k] for k in ['winner','reason','duration']} == {k:result[k] for k in ['winner','reason','duration']}
            await replay_battle(page)
            assert len(requests) == 2
            await page.locator('#launch').click()
            await page.wait_for_timeout(300)
            assert len(requests) == 3
            assert requests[2]['match_id'] != start['match_id']
            assert not errors, errors
            await page.close()
        await browser.close()
    print('Telemetry UI PASS: single, city team, prefecture team; IDs, launch only, finish once, start ordering, replay IDs; no live writes')

asyncio.run(main())
