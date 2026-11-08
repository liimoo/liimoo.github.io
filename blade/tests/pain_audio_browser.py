"""Decode the actual critical assets and verify side-specific playback."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        page = await browser.new_page()
        await page.goto('http://127.0.0.1:8766/blade/')
        result = await page.evaluate('''async () => {
          const {createBladeAudio}=await import('./audio.mjs');
          const ctx=new AudioContext(),sources=[];
          const create=ctx.createBufferSource.bind(ctx);
          ctx.createBufferSource=()=>{const s=create();sources.push(s);return s;};
          const audio=createBladeAudio({contextFactory:()=>ctx});
          await audio.enable();await audio.play('critical');await audio.play('critical',{enemy:true});
          const result={durations:sources.map(s=>s.buffer.duration),rates:sources.map(s=>s.playbackRate.value),distinct:sources[0].buffer!==sources[1].buffer};
          audio.disable();result.muted=!(await audio.play('critical',{enemy:true}));
          await ctx.close();return result;
        }''')
        assert result['distinct'] and result['muted'], result
        assert abs(result['rates'][0]-1.12)<.001 and result['rates'][1]==1, result
        assert .5<result['durations'][0]<.65 and 1.5<result['durations'][1]<1.8, result
        print(result)
        await browser.close()

asyncio.run(main())
