#!/usr/bin/env python3
"""
Test script for continuous playback feature on main page.
Creates screenshots for documentation.
"""

from playwright.sync_api import sync_playwright
import os
import time

SCREENSHOTS_DIR = '/opt/arhipovdan/app/docs/continuous_playback_screenshots'
BASE_URL = 'http://127.0.0.1:3101'

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def main():
    ensure_dir(SCREENSHOTS_DIR)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        console_errors = []
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        
        print("1. Navigating to main page...")
        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')
        time.sleep(2)  # Wait for 3D scene to render
        
        print("2. Taking case1_start screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/case1_start.png')
        
        # Verify Play button exists
        play_button = page.locator('button.play-button')
        if play_button.count() == 0:
            print("ERROR: Play button not found!")
            browser.close()
            return
        
        print("3. Clicking Play Demo button...")
        play_button.click()
        time.sleep(1.5)  # Wait for detection phase
        
        print("4. Taking case1_detection screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/case1_detection.png')
        
        time.sleep(2.5)  # Wait for routing phase
        
        print("5. Taking case1_routing screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/case1_routing.png')
        
        time.sleep(3)  # Wait for case 2 to start
        
        print("6. Taking case2_started screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/case2_started.png')
        
        # Wait for more cases or until finished
        print("7. Waiting for playback to progress...")
        time.sleep(35)  # Wait for remaining cases
        
        print("8. Taking final screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/case8_or_finished.png')
        
        # Verify HUD elements
        print("\nVerification:")
        
        hud = page.locator('.main-hud')
        if hud.count() > 0:
            print("✓ HUD is present")
        else:
            print("✗ HUD not found")
        
        progress_dots = page.locator('.progress-dot')
        print(f"✓ Progress dots count: {progress_dots.count()}")
        
        if len(console_errors) == 0:
            print("✓ No console errors")
        else:
            print(f"✗ Console errors: {len(console_errors)}")
            for err in console_errors[:5]:
                print(f"  - {err[:100]}")
        
        print("\nScreenshots saved to:")
        for f in os.listdir(SCREENSHOTS_DIR):
            if f.endswith('.png'):
                print(f"  - {f}")
        
        browser.close()
        print("\nDone!")

if __name__ == '__main__':
    main()
