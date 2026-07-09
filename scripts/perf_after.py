import time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('docs/performance_physics_fix_screenshots/after')
out.mkdir(parents=True, exist_ok=True)

# (absolute_ms_from_play, filename)
TARGETS = [
    (3800,  '08_no_overlay_overlap.png'),
    (8600,  '03_b_item_enters_b_receiver.png'),
    (10800, '04_b_item_settled_in_b_bin.png'),
    (29500, '05_c_item_settled_in_c_cage.png'),
    (49000, '06_d_item_settled_in_d_cage.png'),
]

logs = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on('console', lambda m: logs.append(f"{m.type}: {m.text}"))
    pg.on('pageerror', lambda e: logs.append(f"pageerror: {e}"))
    pg.goto('https://arhipovdan.ru/?perf=after', wait_until='networkidle')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / '01_home_idle.png'))

    pg.get_by_label('Play demo').click()
    t0 = time.monotonic()

    # measure FPS over first 3s
    fps = pg.evaluate("""async()=>{return await new Promise(r=>{let f=0,s=performance.now();function l(t){f++;if(t-s<3000)requestAnimationFrame(l);else r((f/((t-s)/1000)).toFixed(1));}requestAnimationFrame(l);});}""")
    print("APPROX_FPS_RUNNING=" + str(fps))
    pg.screenshot(path=str(out / '02_play_running_smooth.png'))

    for abs_ms, name in TARGETS:
        target_s = abs_ms / 1000.0
        while time.monotonic() - t0 < target_s:
            pg.wait_for_timeout(150)
        pg.screenshot(path=str(out / name))
        print(f"captured {name} at ~{int((time.monotonic()-t0)*1000)}ms")

    # overview of all receivers: turn auto-cam off for a wide shot
    try:
        pg.get_by_text('AUTO CAM', exact=False).click()
        pg.wait_for_timeout(1500)
    except Exception as e:
        print("autocam toggle skipped:", e)
    pg.screenshot(path=str(out / '07_all_receivers_b_c_d.png'))

    errors = [l for l in logs if l.startswith('error') or l.startswith('pageerror')]
    warns = [l for l in logs if l.startswith('warning')]
    print(f"TOTAL_CONSOLE={len(logs)} ERRORS={len(errors)} WARNINGS={len(warns)}")
    print("SAMPLE=" + json.dumps(logs[:12], ensure_ascii=False))
    b.close()

# mobile + details
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    m = b.new_page(viewport={"width": 390, "height": 844})
    m.goto('https://arhipovdan.ru/', wait_until='networkidle')
    m.wait_for_timeout(2500)
    m.screenshot(path=str(out / '09_mobile.png'), full_page=True)
    sw = m.evaluate("document.documentElement.scrollWidth")
    cw = m.evaluate("document.documentElement.clientWidth")
    print(f"MOBILE scrollWidth={sw} clientWidth={cw} h_scroll={sw > cw}")
    d = b.new_page(viewport={"width": 1440, "height": 900})
    d.goto('https://arhipovdan.ru/details', wait_until='networkidle')
    d.wait_for_timeout(2000)
    d.screenshot(path=str(out / '10_details.png'))
    b.close()
print("DONE")
