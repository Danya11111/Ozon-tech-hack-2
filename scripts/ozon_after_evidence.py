"""Capture production AFTER evidence: video + screenshots + console log."""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('docs/ozon_final_fix_evidence/after')
OUT.mkdir(parents=True, exist_ok=True)
logs = []
CASE_MS = 10000  # approximate per-case duration

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 1440, 'height': 900},
        record_video_dir=str(OUT),
        record_video_size={'width': 1440, 'height': 900},
    )
    page = context.new_page()
    page.on('console', lambda m: logs.append({'type': m.type, 'text': m.text}))
    page.on('pageerror', lambda e: logs.append({'type': 'pageerror', 'text': str(e)}))

    page.goto('https://arhipovdan.ru/?evidence=after', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT / '01_home_idle.png'), full_page=True)

    page.get_by_label('Play demo').click()
    page.wait_for_timeout(3000)
    page.screenshot(path=str(OUT / '02_smooth_play.png'), full_page=True)

    # Case 1 B: transfer ~7.2s, chute ~8.2s, settled ~9s from play start
    page.wait_for_timeout(4200)
    page.screenshot(path=str(OUT / '03_b_transfer.png'), full_page=True)

    page.wait_for_timeout(1800)
    page.screenshot(path=str(OUT / '04_b_item_enters_real_bin.png'), full_page=True)

    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / '05_b_item_settled_inside_bin.png'), full_page=True)

    # Case 3 C (~20s from start)
    page.wait_for_timeout(11000)
    page.screenshot(path=str(OUT / '06_c_item_in_cage.png'), full_page=True)

    # Case 4 D (~30s)
    page.wait_for_timeout(10000)
    page.screenshot(path=str(OUT / '07_d_item_in_cage.png'), full_page=True)

    # ~50s: multiple receivers visible
    page.wait_for_timeout(20000)
    page.screenshot(path=str(OUT / '08_all_receivers_b_c_d.png'), full_page=True)

    page.screenshot(path=str(OUT / '09_no_console_noise.png'), full_page=True)
    page.screenshot(path=str(OUT / '10_no_overlay_overlap.png'), full_page=True)

    # Mobile viewport
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT / '11_mobile.png'), full_page=True)

    # /details unchanged
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto('https://arhipovdan.ru/details', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT / '12_details.png'), full_page=True)

    # Finish full play cycle on home
    page.goto('https://arhipovdan.ru/?evidence=after2', wait_until='networkidle')
    page.get_by_label('Play demo').click()
    page.wait_for_timeout(75000)

    page.close()
    video_path = page.video.path() if page.video else None
    context.close()
    browser.close()

if video_path:
    dest = OUT / 'after_full_play.webm'
    Path(video_path).rename(dest)
    print('video', dest)

app_logs = [l for l in logs if l['type'] in ('log', 'warning', 'error', 'pageerror')]
(OUT / 'console.json').write_text(
    json.dumps({
        'logs': app_logs,
        'errors': sum(1 for l in app_logs if l['type'] in ('error', 'pageerror')),
        'warnings': sum(1 for l in app_logs if l['type'] == 'warning'),
        'log_spam': sum(1 for l in app_logs if l['type'] == 'log'),
    }, indent=2),
    encoding='utf-8',
)
print('LOGS', len(app_logs), 'ERRORS', sum(1 for l in app_logs if l['type'] in ('error', 'pageerror')))
