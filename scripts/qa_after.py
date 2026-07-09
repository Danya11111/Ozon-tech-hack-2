import time
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('docs/final_physics_fix_screenshots/after')
out.mkdir(parents=True, exist_ok=True)

# (absolute_ms_from_play, filename)
TARGETS = [
    (1300,  '02_belt_sync_t0.png'),
    (2300,  '03_belt_sync_t1_delta_1m.png'),
    (2600,  '01_stl_box_on_belt.png'),
    (3800,  '10_no_overlay_overlap.png'),
    (9500,  '04_b_receiver_item_settled.png'),
    (10500, '09_all_zones_physical.png'),
    (26800, '05_chute_c_motion.png'),
    (28900, '06_item_inside_c_cage.png'),
    (46400, '07_chute_d_motion.png'),
    (48500, '08_item_inside_d_cage.png'),
]

errs = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on('console', lambda m: errs.append(f"{m.type}: {m.text}") if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))
    page.goto('https://arhipovdan.ru/?qa=after', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.get_by_label('Play demo').click()
    t0 = time.monotonic()
    for abs_ms, name in TARGETS:
        target_s = abs_ms / 1000.0
        while True:
            elapsed = time.monotonic() - t0
            if elapsed >= target_s:
                break
            page.wait_for_timeout(int(min(200, (target_s - elapsed) * 1000)))
        page.screenshot(path=str(out / name))
        print(f"captured {name} at ~{int((time.monotonic()-t0)*1000)}ms")
    browser.close()

# Mobile + details in a fresh context
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    m = browser.new_page(viewport={"width": 390, "height": 844})
    m.on('console', lambda msg: errs.append(f"mobile {msg.type}: {msg.text}") if msg.type == 'error' else None)
    m.goto('https://arhipovdan.ru/', wait_until='networkidle')
    m.wait_for_timeout(2500)
    m.screenshot(path=str(out / '11_mobile.png'), full_page=True)
    scroll_w = m.evaluate("document.documentElement.scrollWidth")
    client_w = m.evaluate("document.documentElement.clientWidth")
    print(f"MOBILE scrollWidth={scroll_w} clientWidth={client_w} horizontal_scroll={scroll_w > client_w}")

    d = browser.new_page(viewport={"width": 1440, "height": 900})
    d.on('console', lambda msg: errs.append(f"details {msg.type}: {msg.text}") if msg.type == 'error' else None)
    d.goto('https://arhipovdan.ru/details', wait_until='networkidle')
    d.wait_for_timeout(2000)
    d.screenshot(path=str(out / '12_details.png'), full_page=False)
    browser.close()

print("CONSOLE_ERRORS:" + ("\n".join(errs) if errs else "NONE"))
