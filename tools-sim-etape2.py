# Simulation accélérée de l'étape 2 (la nuit) avec plusieurs styles de jeu.
# Usage : node build.mjs, puis python3 tools-sim-etape2.py [nuits traversées]. Nécessite playwright (pip install playwright).
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

CYCLES = int(sys.argv[1]) if len(sys.argv) > 1 else 0
DIST = (pathlib.Path(__file__).parent / 'dist' / 'index.html').resolve().as_uri()

POLICY = r"""
(cfg) => {
  const S2 = __S2, E = __E, s = () => E.S.s2, ILL = ['necker', 'kanizsa', 'hermann', 'fraser', 'rubin', 'moire'];
  E.S.cycles = cfg.cycles; E.S.stage = 2; E.S.s2 = S2.fresh(['enter']); E.S.s2.calm = true;
  Object.assign(S2.rt, { take: null, reveal: null, sheet: null, queue: 0, hq: 0, shown: null });
  let acc = 0, t = 0, takeT = 0; const pieceAt = [];
  const step = dt => {
    // clics humains (le style idle arrête de cliquer dès la première Main étrangère)
    if (!(cfg.idleAfterHand && s().up.main > 0)) { acc += cfg.cps * dt; while (acc >= 1) { acc--; S2.click(); } }
    // le dessin d'abord, puis l'illusion suivante, puis la marque la moins chère
    if (s().F >= S2.pieceCost()) { S2.buyPiece(); pieceAt.push(Math.round(t / 6) / 10); }
    for (const id of ILL) if (!s().unl[id]) { S2.pickIllusion(id); break; }
    const owned = ILL.filter(id => s().unl[id]), best = owned[owned.length - 1]; if (best !== s().sel) S2.pickIllusion(best);
    const ups = S2.UP2.slice().sort((a, b) => S2.up2Cost(a) - S2.up2Cost(b));
    if (s().F >= S2.up2Cost(ups[0]) * cfg.buyMargin) S2.buyUp(ups[0].id);
    S2.devStep(dt); t += dt; if (S2.taking()) takeT += dt;
  };
  return { run: maxMin => { for (let i = 0; i < maxMin * 1200 && !s().ended; i++) step(.05);
    return { min: Math.round(t / 6) / 10, pieces: pieceAt, takes: s().takes, takeMin: Math.round(takeT / 6) / 10, up: { ...s().up }, ended: s().ended }; } };
}
"""
STRATS = {
  'actif 4 clics/s': dict(cps=4, buyMargin=1, idleAfterHand=False),
  'modere 2 clics/s': dict(cps=2, buyMargin=1.5, idleAfterHand=False),
  'idle': dict(cps=2, buyMargin=1, idleAfterHand=True),
  'passif 1 clic/s': dict(cps=1, buyMargin=2, idleAfterHand=False),
}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, cfg in STRATS.items():
            pg = await b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(DIST + '#dev'); await pg.wait_for_timeout(600)
            r = await pg.evaluate("(cfg) => (" + POLICY + ")(cfg).run(40)", {**cfg, 'cycles': CYCLES})
            print(f"{name:18} {json.dumps(r)}", errs[:2])
            await pg.close()
        await b.close()

asyncio.run(main())
