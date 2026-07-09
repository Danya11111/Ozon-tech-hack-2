from pathlib import Path
from playwright.sync_api import sync_playwright
import time, json

out = Path('docs/performance_physics_fix_screenshots/after')
out.mkdir(parents=True, exist_ok=True)
logs = []

TARGETS = [
    (0,     '01_home_idle.png'),
    (2500,  '02_play_running_smooth.png'),
    (8800,  '03_b_item_enters_b_receiver.png'),
    (10200, '04_b_item_settled_in_b_bin.png'),
    (29000, '05_c_item_settled_in_c_cage.png'),
    (48500, '06_d_item_settled_in_d_cage.png'),
    (52000, '07_all_receivers_b_c_d.png'),
    (5600,  '08_no_overlay_overlap.png'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on('console', lambda m: logs.append({'type': m.type, 'text': m.text}))
    page.on('pageerror', lambda e: logs.append({'type': 'pageerror', 'text': str(e)}))
    page.goto('https://arhipovdan.ru/?qa=perf-after', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=str(out / '01_home_idle.png'))
    page.get_by_label('Play demo').click()
    t0 = time.monotonic()
    for abs_ms, name in TARGETS:
        if name == '01_home_idle.png':
            continue
        target_s = abs_ms / 1000.0
        while time.monotonic() - t0 < target_s:
            page.wait_for_timeout(50)
        page.screenshot(path=str(out / name))
        print(f'captured {name} at ~{int((time.monotonic()-t0)*1000)}ms')
    browser.close()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    m = browser.new_page(viewport={"width": 390, "height": 844})
    m.on('console', lambda msg: logs.append({'type': f'mobile-{msg.type}', 'text': msg.text}))
    m.goto('https://arhipovdan.ru/', wait_until='networkidle')
    m.wait_for_timeout(2500)
    m.screenshot(path=str(out / '09_mobile.png'), full_page=True)
    scroll_w = m.evaluate('document.documentElement.scrollWidth')
    client_w = m.evaluate('document.documentElement.clientWidth')
    print(f'MOBILE scroll={scroll_w} client={client_w} hscroll={scroll_w > client_w}')
    d = browser.new_page(viewport={"width": 1440, "height": 900})
    d.goto('https://arhipovdan.ru/details', wait_until='networkidle')
    d.wait_for_timeout(2000)
    d.screenshot(path=str(out / '10_details.png'))
    browser.close()

errors = [l for l in logs if l['type'] in ('error', 'pageerror')]
spam = [l for l in logs if l['type'] == 'log']
(out / 'after_console.json').write_text(json.dumps({'logs': logs, 'errors': len(errors), 'spam_logs': len(spam)}, ensure_ascii=False, indent=2))
print('ERRORS', len(errors), 'SPAM_LOGS', len(spam))
