#!/usr/bin/env python3
"""Test CV inspection overlay and take screenshots."""

from playwright.sync_api import sync_playwright
import os
import time

SCREENSHOTS_DIR = '/opt/arhipovdan/app/docs/inspection_overlay_screenshots'
PROD_URL = 'https://arhipovdan.ru'

def main():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        console_errors = []
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        
        print(f"1. Navigating to {PROD_URL}/")
        page.goto(f'{PROD_URL}/')
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        print("2. Clicking Play...")
        play_button = page.locator('button.play-button')
        play_button.click()
        
        # Wait for detection phase (~1.7s after spawn)
        time.sleep(2)
        print("3. Taking inspection_detection screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/inspection_detection.png')
        
        # Wait for measurement phase
        time.sleep(1)
        print("4. Taking inspection_measurement screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/inspection_measurement.png')
        
        # Wait for classification
        time.sleep(1)
        print("5. Taking inspection_classification screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/inspection_classification.png')
        
        # Wait for routing
        time.sleep(1)
        print("6. Taking inspection_routing screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/inspection_routing.png')
        
        # Wait for C priority case (case 7)
        print("7. Waiting for c_priority case (case 7)...")
        time.sleep(35)  # Skip to case 7
        
        # Take c_priority screenshot during measurement/classification
        time.sleep(2)
        print("8. Taking c_priority_inspection screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/c_priority_inspection.png')
        
        # Wait for low_confidence case (case 8)
        time.sleep(7)
        print("9. Taking low_confidence_warning screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/low_confidence_warning.png')
        
        # Verify elements
        print("\nVerification:")
        cv_overlay = page.locator('.cv-overlay')
        hud = page.locator('.main-hud')
        
        # Refresh and check overlay visibility
        page.goto(f'{PROD_URL}/')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        play_button = page.locator('button.play-button')
        play_button.click()
        time.sleep(2)
        
        print(f"  CV overlay visible: {'✓' if cv_overlay.count() > 0 else '✗'}")
        print(f"  HUD visible: {'✓' if hud.count() > 0 else '✗'}")
        
        if len(console_errors) == 0:
            print("\n✓ No console errors")
        else:
            print(f"\n✗ Console errors: {len(console_errors)}")
            for err in console_errors[:5]:
                print(f"  - {err[:100]}")
        
        print(f"\nScreenshots saved to {SCREENSHOTS_DIR}/")
        for f in sorted(os.listdir(SCREENSHOTS_DIR)):
            if f.endswith('.png'):
                print(f"  - {f}")
        
        browser.close()
        print("\nDone!")

if __name__ == '__main__':
    main()
