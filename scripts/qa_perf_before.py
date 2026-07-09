from pathlib import Path
from playwright.sync_api import sync_playwright
import time, json

out = Path('docs/performance_physics_fix_screenshots/before')
out.mkdir(parents=True, exist_ok=True)
logs = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1440,"height":900})
    page.on('console', lambda m: logs.append({'type': m.type, 'text': m.text}))
    page.on('pageerror', lambda e: logs.append({'type':'pageerror','text':str(e)}))
    page.goto('https://arhipovdan.ru/?qa=perf-before', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path=str(out/'before_home.png'), full_page=True)
    page.get_by_label('Play demo').click()
    page.wait_for_timeout(3000)
    page.screenshot(path=str(out/'before_play_running.png'), full_page=True)
    page.wait_for_timeout(7000)
    page.screenshot(path=str(out/'before_b_item_stopped_on_belt.png'), full_page=True)
    metrics = page.evaluate('''() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perf ? perf.domContentLoadedEventEnd : null,
        loadEvent: perf ? perf.loadEventEnd : null,
        longTasks: performance.getEntriesByType('longtask').length,
      };
    }''')
    (out/'before_console.json').write_text(json.dumps({'logs': logs, 'metrics': metrics}, ensure_ascii=False, indent=2))
    print('LOGS', len(logs), 'ERRORS', sum(1 for l in logs if l['type']=='error'))
    browser.close()
