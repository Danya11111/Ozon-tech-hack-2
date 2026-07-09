import time
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('docs/final_physical_acceptance_screenshots')
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    errors = []
    page.on('console', lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f"pageerror: {exc}"))
    
    page.goto('https://arhipovdan.ru/?qa=final', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path=str(out / '01_home_idle.png'), full_page=True)
    
    page.get_by_label('Play demo').click()
    
    def wait_for_hud(text, timeout=20000):
        try:
            page.wait_for_selector(f".main-hud:has-text('{text}')", timeout=timeout)
        except Exception as e:
            errors.append(f"Timeout waiting for HUD text: {text} - {e}")
            
    # Case 1: box_b -> B
    wait_for_hud('1/8')
    wait_for_hud('CV Detection')
    page.screenshot(path=str(out / '02_stl_item_on_belt.png'), full_page=True)
    
    wait_for_hud('Routing to zone')
    page.screenshot(path=str(out / '03_belt_sync_t0.png'), full_page=True)
    page.wait_for_timeout(1000)
    page.screenshot(path=str(out / '04_belt_sync_t1.png'), full_page=True)
    
    # Wait for Exit to zone for Case 1 (route to B)
    wait_for_hud('Exit to zone')
    page.screenshot(path=str(out / '05_route_to_b.png'), full_page=True)

    # Case 3: oversized_box_c -> C
    wait_for_hud('3/8')
    wait_for_hud('Routing to zone', timeout=30000)
    page.screenshot(path=str(out / '06_route_to_c_chute.png'), full_page=True)
    
    wait_for_hud('4/8', timeout=20000) # Case 3 is settled
    page.wait_for_timeout(500)
    page.screenshot(path=str(out / '07_settled_in_c_cage.png'), full_page=True)
    
    # Case 5: plate_d -> D
    wait_for_hud('5/8', timeout=30000)
    wait_for_hud('Routing to zone', timeout=20000)
    page.screenshot(path=str(out / '08_route_to_d_chute.png'), full_page=True)
    
    wait_for_hud('6/8', timeout=20000) # Case 5 is settled
    page.wait_for_timeout(500)
    page.screenshot(path=str(out / '09_settled_in_d_cage.png'), full_page=True)
    
    # Case 7: c_priority -> C
    wait_for_hud('7/8', timeout=30000)
    wait_for_hud('Routing to zone', timeout=20000)
    page.screenshot(path=str(out / '10_c_priority_to_c.png'), full_page=True)

    # Case 8: low_confidence -> warning
    wait_for_hud('8/8', timeout=30000)
    wait_for_hud('⚠', timeout=20000) # Wait for warning
    page.screenshot(path=str(out / '11_low_confidence_warning.png'), full_page=True)
    
    # Wait for demo complete
    try:
        page.wait_for_selector('text=All 8 cases demonstrated successfully', timeout=60000)
        page.screenshot(path=str(out / '12_demo_complete.png'), full_page=True)
    except Exception as e:
        errors.append(f"Timeout waiting for Demo Complete: {e}")

    # Mobile
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(1000)
    page.screenshot(path=str(out / '13_mobile.png'), full_page=True)
    
    # Details
    page.goto('https://arhipovdan.ru/details?qa=final', wait_until='networkidle')
    page.wait_for_timeout(1000)
    page.screenshot(path=str(out / '14_details.png'), full_page=True)
    
    browser.close()
    
if errors:
    print("ERRORS:")
    for e in errors:
        print(e)
else:
    print("NO_CONSOLE_ERRORS")
