"""Actual decoded launch audio survives a burst of other effects."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        page = await browser.new_page()
        await page.goto('http://127.0.0.1:8766/blade/')
        result = await page.evaluate('''async () => {
          const {createBladeAudio}=await import('./audio.mjs');
          const ctx=new AudioContext(), sources=[];
          const factory=ctx.createBufferSource.bind(ctx);
          ctx.createBufferSource=()=>{
            const source=factory(),stop=source.stop.bind(source);
            source.stop=(...args)=>{source.wasStopped=true;stop(...args);};
            source.addEventListener('ended',()=>{source.didEnd=true;});
            sources.push(source);return source;
          };
          const audio=createBladeAudio({contextFactory:()=>ctx});
          await audio.enable();await audio.play('launch');
          const launch=sources[0];
          for(let i=0;i<12;i++)await audio.play('critical');
          const survived=!launch.wasStopped;
          await new Promise(r=>setTimeout(r,launch.buffer.duration*1000+250));
          const naturalEnd=launch.didEnd&&!launch.wasStopped;
          await audio.play('launch');await audio.play('hit');audio.disable();
          const muted=sources.slice(-2).every(s=>s.wasStopped);
          await ctx.close();return {survived,naturalEnd,muted};
        }''')
        assert all(result.values()), result
        print(result)
        await browser.close()

asyncio.run(main())
