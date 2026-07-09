#!/usr/bin/env python3
"""Test production site and take screenshots."""

from playwright.sync_api import sync_playwright
import os
import time

SCREENSHOTS_DIR = '/opt/arhipovdan/app/docs/production_sync_screenshots'
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
        time.sleep(3)  # Wait for 3D to render
        
        print("2. Taking prod_home_after_deploy screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/prod_home_after_deploy.png')
        
        # Check for key elements
        play_button = page.locator('button.play-button')
        details_link = page.locator('.details-link')
        hud = page.locator('.main-hud')
        progress_dots = page.locator('.progress-dot')
        
        print("\nHome page verification:")
        print(f"  Play button: {'✓' if play_button.count() > 0 else '✗'}")
        print(f"  Details link: {'✓' if details_link.count() > 0 else '✗'}")
        print(f"  HUD present: {'✓' if hud.count() > 0 else '✗'}")
        print(f"  Progress dots: {progress_dots.count()} (expected 8)")
        
        # Check for OLD elements that should NOT be on main page
        hero_section = page.locator('.hero-section')
        product_demo = page.locator('.product-demo')
        
        print(f"  HeroSection absent: {'✓' if hero_section.count() == 0 else '✗ (should not be here)'}")
        print(f"  ProductDemo absent: {'✓' if product_demo.count() == 0 else '✗ (should not be here)'}")
        
        print(f"\n3. Navigating to {PROD_URL}/details")
        page.goto(f'{PROD_URL}/details')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        
        print("4. Taking prod_details_after_deploy screenshot...")
        page.screenshot(path=f'{SCREENSHOTS_DIR}/prod_details_after_deploy.png')
        
        # Check for details page elements
        header = page.locator('header')
        hero_section = page.locator('.hero-section')
        product_demo = page.locator('.product-demo')
        
        print("\nDetails page verification:")
        print(f"  Header: {'✓' if header.count() > 0 else '✗'}")
        print(f"  HeroSection: {'✓' if hero_section.count() > 0 else '✗'}")
        print(f"  ProductDemo: {'✓' if product_demo.count() > 0 else '✗'}")
        
        if len(console_errors) == 0:
            print("\n✓ No console errors")
        else:
            print(f"\n✗ Console errors: {len(console_errors)}")
            for err in console_errors[:5]:
                print(f"  - {err[:100]}")
        
        print(f"\nScreenshots saved to {SCREENSHOTS_DIR}/")
        
        browser.close()
        print("\nDone!")

if __name__ == '__main__':
    main()
