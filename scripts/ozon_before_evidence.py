"""Capture production BEFORE evidence: video + screenshots + console log."""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('docs/ozon_final_fix_evidence/before')
OUT.mkdir(parents=True, exist_ok=True)
logs = []

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

    page.goto('https://arhipovdan.ru/?evidence=before', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT / '01_idle.png'), full_page=True)

    page.get_by_label('Play demo').click()
    page.wait_for_timeout(2500)
    page.screenshot(path=str(OUT / '02_b_item_problem.png'), full_page=True)

    page.wait_for_timeout(6000)
    page.screenshot(path=str(OUT / '05_item_stopped_on_conveyor.png'), full_page=True)

    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT / '04_b_no_real_bin.png'), full_page=True)

    # ~12s: case1 exit / B routing end
    page.wait_for_timeout(3000)
    page.screenshot(path=str(OUT / '03_lag_or_console.png'), full_page=True)

    # Full cycle ~80s
    page.wait_for_timeout(65000)

    page.close()
    video_path = page.video.path() if page.video else None
    context.close()
    browser.close()

if video_path:
    dest = OUT / 'before_full_play.webm'
    Path(video_path).rename(dest)
    print('video', dest)

(OUT / '06_console.json').write_text(
    json.dumps({'logs': logs, 'errors': sum(1 for l in logs if l['type'] == 'error'),
                'warnings': sum(1 for l in logs if l['type'] == 'warning'),
                'log_spam': sum(1 for l in logs if l['type'] == 'log')}, indent=2),
    encoding='utf-8',
)
print('LOGS', len(logs), 'ERRORS', sum(1 for l in logs if l['type'] == 'error'))
