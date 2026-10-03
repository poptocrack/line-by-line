import asyncio,json,time
from playwright.async_api import async_playwright
POLICY = r"""
(cfg) => {
  const S2=__S2, E=__E, s=()=>E.S.s2, ILL=['necker','kanizsa','hermann','fraser','rubin','moire'];
  const st={t:0, clickAcc:0, log:[], losses:0, marks:{}, rituals:0, firstAt:{}};
  const prof=id=>S2.illusionProfile(id);
  const step=(dt)=>{
    // clics humains
    if (cfg.restAt) { if (!st.resting && s().presence>=cfg.restAt) st.resting=true; if (st.resting && s().presence<=cfg.restUntil) st.resting=false; }
    if (cfg.clicksPerSec && !st.resting && !(cfg.idleAfterHand && s().up.main>0)) { st.clickAcc+=cfg.clicksPerSec*dt; while(st.clickAcc>=1){st.clickAcc-=1; S2.click();} }
    // rituel
    if (s().presence>=cfg.ritualAt && s().F>=S2.ritualCost() && !S2.rt.ritual && !(S2.rt.ritualCd>0)) { S2.ritual(); st.rituals++; }
    // débloquer l'illusion suivante si possible
    for (const id of ILL) { const d={necker:0,kanizsa:60,hermann:250,fraser:900,rubin:3000,moire:9000}[id]; if (!s().unl[id] && s().F>=d*cfg.unlockMargin) { S2.pickIllusion(id); break; } }
    // choisir l'illusion
    const owned=ILL.filter(id=>s().unl[id]);
    let best=s().sel;
    if (cfg.pick==='hours') best=owned.reduce((a,b)=>prof(b).hours/ (b==='necker'?12:b==='kanizsa'?15:b==='hermann'?12:b==='fraser'?222:b==='rubin'?34:20) > prof(a).hours/(a==='necker'?12:a==='kanizsa'?15:a==='hermann'?12:a==='fraser'?222:a==='rubin'?34:20)?b:a, owned[0]);
    if (cfg.pick==='reveal') best=owned[owned.length-1];
    if (best!==s().sel) S2.pickIllusion(best);
    // marques
    for (const id of cfg.buy) { const u=S2.UP2.find(x=>x.id===id); if (s().F>=S2.up2Cost(u)*cfg.buyMargin) { S2.buyUp(id); st.marks[id]=(st.marks[id]||0)+1; } }
    const before=s().visions; S2.devStep(dt); if (s().visions>before) st.losses++;
    st.t+=dt;
    for (const k of [10,25,50,75,100]) if (!st.firstAt[k] && S2.finalPct()>=k) st.firstAt[k]=Math.round(st.t/60*10)/10;
  };
  return { run:(sec)=>{ const n=Math.round(sec/0.05); for(let i=0;i<n;i++) step(0.05); return {min:Math.round(st.t/60*10)/10, F:Math.round(s().F), pres:Math.round(s().presence), final:Math.round(S2.finalPct()*10)/10, losses:st.losses, rituals:st.rituals, up:{...s().up}, unl:Object.keys(s().unl).length, firstAt:st.firstAt, ended:s().ended}; } };
}
"""
STRATS = {
  'prudent':  dict(clicksPerSec=5, ritualAt=70, restAt=50, restUntil=20, unlockMargin=1.0, pick='hours', buy=['veille','oeil'], buyMargin=1.0, idleAfterHand=False),
  'gourmand': dict(clicksPerSec=5, ritualAt=92, restAt=85, restUntil=60, unlockMargin=1.0, pick='hours', buy=['oeil','veille'], buyMargin=1.0, idleAfterHand=False),
  'sans_pause': dict(clicksPerSec=5, ritualAt=70, restAt=0, restUntil=0, unlockMargin=1.0, pick='hours', buy=['veille','oeil'], buyMargin=1.0, idleAfterHand=False),
  'idle':     dict(clicksPerSec=5, ritualAt=70, restAt=0, restUntil=0, unlockMargin=1.0, pick='hours', buy=['main','veille','oeil'], buyMargin=1.0, idleAfterHand=True),
}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for name,cfg in STRATS.items():
            st={'g':0,'stage':2,'s2':{'F':0,'total':0,'presence':0,'final':0,'ended':False,'up':{'main':0,'oeil':0,'veille':0},'rituals':0,'unl':{'necker':1},'sel':'necker','done':0,'visions':0,'notes':['enter'],'calm':True,'lastSeen':int(time.time()*1000)},'muted':True,'lang':'fr'}
            ctx=await b.new_context(viewport={'width':1440,'height':900})
            await ctx.add_init_script("if(!sessionStorage.getItem('x')){localStorage.setItem('trait-pour-trait-v1',%s);sessionStorage.setItem('x','1')}"%json.dumps(json.dumps(st)))
            pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('file:///home/claude/tpt/dist/index.html#dev'); await pg.wait_for_timeout(600)
            await pg.evaluate("(cfg)=>{ window.__sim=("+POLICY+")(cfg) }", cfg)
            rows=[]
            for chunk in range(6):   # 6 x 5 min = 30 min de jeu
                r=await pg.evaluate("()=>__sim.run(300)")
                rows.append(r)
            print(name, '| 10 min:', json.dumps({k:rows[1][k] for k in ['final','losses','rituals','pres','unl']}), '| 30 min:', json.dumps({k:rows[-1][k] for k in ['final','losses','rituals','F','up','firstAt','ended']}), errs[:2])
            await ctx.close()
        await b.close()
asyncio.run(main())
