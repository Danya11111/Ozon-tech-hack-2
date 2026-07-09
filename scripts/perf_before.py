import time, json
from pathlib import Path
from playwright.sync_api import sync_playwright
out = Path('docs/performance_physics_fix_screenshots/before'); out.mkdir(parents=True, exist_ok=True)
logs=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.on('console', lambda m: logs.append(f"{m.type}: {m.text}"))
    pg.on('pageerror', lambda e: logs.append(f"pageerror: {e}"))
    pg.goto('https://arhipovdan.ru/?perf=before', wait_until='networkidle'); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out/'before_home.png'))
    pg.get_by_label('Play demo').click()
    # measure approx FPS via rAF over 3s
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(out/'before_play_running.png'))
    fps=pg.evaluate("""async()=>{return await new Promise(r=>{let f=0,s=performance.now();function l(t){f++;if(t-s<3000)requestAnimationFrame(l);else r((f/((t-s)/1000)).toFixed(1));}requestAnimationFrame(l);});}""")
    print("APPROX_FPS_RUNNING="+str(fps))
    pg.wait_for_timeout(6000)
    pg.screenshot(path=str(out/'before_b_item_stopped_on_belt.png'))
    errors=[l for l in logs if l.startswith('error') or l.startswith('pageerror')]
    warns=[l for l in logs if l.startswith('warning')]
    print(f"TOTAL_CONSOLE={len(logs)} ERRORS={len(errors)} WARNINGS={len(warns)}")
    print("SAMPLE_LOGS="+json.dumps(logs[:20], ensure_ascii=False))
    b.close()
