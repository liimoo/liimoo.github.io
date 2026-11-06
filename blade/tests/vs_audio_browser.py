"""Exercise real VS/launch audio and cancellation through game UI (port 8766)."""
import asyncio
from playwright.async_api import async_playwright
from browser_flow_helpers import enter_selection, select_solo_match, start_battle


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(reduced_motion='no-preference')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.route('**/googletagmanager.com/**', lambda route: route.abort())
        await page.add_init_script('''
          window.audioProbe = {events: [], nextId: 0};
          const start = AudioBufferSourceNode.prototype.start;
          const stop = AudioBufferSourceNode.prototype.stop;
          AudioBufferSourceNode.prototype.start = function(...args) {
            this.probeId = ++audioProbe.nextId;
            audioProbe.events.push({kind:'start', id:this.probeId, duration:this.buffer.duration});
            return start.apply(this, args);
          };
          AudioBufferSourceNode.prototype.stop = function(...args) {
            audioProbe.events.push({kind:'stop', id:this.probeId});
            return stop.apply(this, args);
          };
        ''')
        await page.goto('http://127.0.0.1:8766/blade/')
        # Decode the actual assets independently to identify sources by duration.
        durations = await page.evaluate('''async () => {
          const {CUES} = await import('./audio.mjs');
          const ctx = new AudioContext();
          const result = {};
          for (const cue of ['vs', 'launch']) {
            const response = await fetch(CUES[cue]);
            if (!response.ok) throw new Error(`Missing ${cue}`);
            result[cue] = (await ctx.decodeAudioData(await response.arrayBuffer())).duration;
          }
          await ctx.close(); return result;
        }''')
        assert abs(durations['vs'] - durations['launch']) > .1, durations
        assert await page.evaluate('audioProbe.events.length') == 0
        await enter_selection(page)
        await page.wait_for_function("audioProbe.events.some(e => e.kind === 'start')")
        await select_solo_match(page)
        await start_battle(page)

        await page.locator('#battle-back').click()

        async def enter_vs():
            await page.evaluate('audioProbe.events = []')
            await page.locator('#confirm-match').click()
            await page.wait_for_function('''duration => audioProbe.events.some(
              e => e.kind === 'start' && Math.abs(e.duration - duration) < .001)''',
              arg=durations['vs'])
            assert await page.locator('#vs-screen').is_visible()
            events = await page.evaluate('audioProbe.events')
            starts = [event for event in events if event['kind'] == 'start']
            assert len(starts) == 1, events
            return starts[0]['id']

        vs_id = await enter_vs()
        await page.locator('#vs-back').click()
        assert await page.evaluate('(id) => audioProbe.events.some(e => e.kind === "stop" && e.id === id)', vs_id)
        await page.wait_for_timeout(1500)
        assert await page.locator('#choose-region').is_visible()

        vs_id = await enter_vs()
        await page.locator('#skip-vs').click()
        await page.locator('#battle').wait_for()
        assert await page.evaluate('(id) => audioProbe.events.some(e => e.kind === "stop" && e.id === id)', vs_id)
        await page.evaluate('audioProbe.events = []')
        await page.locator('#launch').click()
        await page.wait_for_function('''duration => audioProbe.events.some(
          e => e.kind === 'start' && Math.abs(e.duration - duration) < .001)''',
          arg=durations['launch'])
        events = await page.evaluate('audioProbe.events')
        assert not any(event['kind'] == 'start' and abs(event['duration'] - durations['vs']) < .001 for event in events), events

        await page.locator('#sound').click()
        await page.locator('#battle-back').click()
        await page.evaluate('audioProbe.events = []')
        await page.locator('#confirm-match').click()
        await page.locator('#vs-screen').wait_for()
        await page.wait_for_timeout(150)
        assert await page.evaluate('audioProbe.events.length') == 0
        await page.locator('#skip-vs').click()
        await page.locator('#launch').click()
        await page.wait_for_timeout(200)
        assert await page.evaluate('audioProbe.events.length') == 0
        assert not errors, errors
        print('VS cue, distinct launch cue, skip/back cancellation, and muted VS/launch PASS')
        await browser.close()


asyncio.run(main())
