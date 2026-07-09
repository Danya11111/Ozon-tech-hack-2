#!/usr/bin/env python3
"""Test light scene and take screenshots."""

from playwright.sync_api import sync_playwright
import os
import time

SCREENSHOTS_DIR = '/opt/arhipovdan/app/docs/light_scene_screenshots'
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
        
        print("2. Taking light_idle screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/light_idle.png')
        
        # Verify elements
        play_button = page.locator('button.play-button')
        hud = page.locator('.main-hud')
        progress_dots = page.locator('.progress-dot')
        
        print("\nIdle state verification:")
        print(f"  Play button: {'✓' if play_button.count() > 0 else '✗'}")
        print(f"  HUD present: {'✓' if hud.count() > 0 else '✗'}")
        print(f"  Progress dots: {progress_dots.count()}")
        
        print("\n3. Clicking Play...")
        play_button.click()
        time.sleep(0.5)
        
        print("4. Taking light_play_started screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/light_play_started.png')
        
        time.sleep(3)
        
        print("5. Taking light_running_3s screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/light_running_3s.png')
        
        time.sleep(3)
        
        print("6. Taking light_route_active screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/light_route_active.png')
        
        # Check /details still works
        print(f"\n7. Checking {PROD_URL}/details")
        page.goto(f'{PROD_URL}/details')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        
        header = page.locator('header')
        hero = page.locator('.hero-section')
        
        print("\nDetails page verification:")
        print(f"  Header: {'✓' if header.count() > 0 else '✗'}")
        print(f"  HeroSection: {'✓' if hero.count() > 0 else '✗'}")
        
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
