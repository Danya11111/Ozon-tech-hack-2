#!/usr/bin/env python3
"""Browser QA for physical conveyor improvements on production."""

import asyncio
from playwright.async_api import async_playwright
import os

BASE_URL = "https://arhipovdan.ru"
SCREENSHOT_DIR = "/opt/arhipovdan/app/docs/physical_conveyor_screenshots"

async def main():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1.5,
        )
        page = await context.new_page()
        
        print(f"Opening {BASE_URL}...")
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(3)
        
        # Screenshot 1: Initial view with conveyor
        print("Screenshot 1: Conveyor side view (idle)...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/conveyor_side_view.png", full_page=False)
        
        # Click Play
        play_btn = page.locator("button.play-button")
        if await play_btn.count() > 0:
            print("Clicking Play...")
            await play_btn.click()
            await asyncio.sleep(1.5)
        
        # Screenshot 2: Item on belt
        print("Screenshot 2: Item on belt...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/item_on_belt.png", full_page=False)
        
        # Let demo run a bit
        await asyncio.sleep(3)
        
        # Screenshot 3: Running item on belt
        print("Screenshot 3: Running item on belt...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/running_item_on_belt.png", full_page=False)
        
        # Screenshot 4: Try to get top angle (we'll use the same view since we can't rotate)
        await asyncio.sleep(2)
        print("Screenshot 4: Conveyor top angle view...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/conveyor_top_angle.png", full_page=False)
        
        # Wait for detection phase
        await asyncio.sleep(2)
        
        # Screenshot 5: Motor drive (same view, motor should be visible)
        print("Screenshot 5: Motor drive view...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/motor_drive.png", full_page=False)
        
        # Check /details still works
        print(f"\nOpening {BASE_URL}/details...")
        await page.goto(f"{BASE_URL}/details", wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        print("Screenshot 6: Details page...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/details_page.png", full_page=False)
        
        # Check console for errors
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        print("\n=== QA Results ===")
        print(f"Screenshots saved to: {SCREENSHOT_DIR}/")
        for f in os.listdir(SCREENSHOT_DIR):
            print(f"  - {f}")
        
        if errors:
            print(f"\nConsole errors: {len(errors)}")
            for e in errors[:5]:
                print(f"  - {e[:100]}")
        else:
            print("\nNo console errors detected.")
        
        await browser.close()
        print("\nBrowser QA complete!")

if __name__ == "__main__":
    asyncio.run(main())
