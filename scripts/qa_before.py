from pathlib import Path
from playwright.sync_api import sync_playwright
out = Path('docs/final_physics_fix_screenshots/before')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1440,"height":900})
    errs=[]
    page.on('console', lambda m: errs.append(f"{m.type}: {m.text}") if m.type=='error' else None)
    page.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))
    page.goto('https://arhipovdan.ru/?qa=before', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path=str(out/'before_idle.png'), full_page=True)
    page.get_by_label('Play demo').click()
    for i in range(12):
        page.wait_for_timeout(1500)
        page.screenshot(path=str(out/f'before_t{i:02d}.png'), full_page=True)
    print("ERRORS:" + "\n".join(errs) if errs else "NO_CONSOLE_ERRORS")
    browser.close()
