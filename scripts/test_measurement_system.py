#!/usr/bin/env python3
"""Browser QA for measurement system on production."""

import asyncio
from playwright.async_api import async_playwright
import os

BASE_URL = "https://arhipovdan.ru"
SCREENSHOT_DIR = "/opt/arhipovdan/app/docs/measurement_system_screenshots"

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
        await asyncio.sleep(2)
        
        # Click Play
        play_btn = page.locator("button.play-button")
        if await play_btn.count() > 0:
            print("Clicking Play...")
            await play_btn.click()
            await asyncio.sleep(2)
        
        # Screenshot 1: Stepper counting (detection phase)
        print("Screenshot 1: Stepper counting...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/stepper_counting.png", full_page=False)
        
        # Wait for measurement phase
        await asyncio.sleep(2)
        
        # Screenshot 2: Laser height measurement
        print("Screenshot 2: Laser height measurement...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/laser_height_measurement.png", full_page=False)
        
        # Wait for classification
        await asyncio.sleep(2)
        
        # Screenshot 3: Stereo shape measurement
        print("Screenshot 3: Stereo shape measurement...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/stereo_shape_measurement.png", full_page=False)
        
        # Let demo run to routing phase
        await asyncio.sleep(3)
        
        # Screenshot 4: Route command sent
        print("Screenshot 4: Route command sent...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/route_command_sent.png", full_page=False)
        
        # Wait for C-priority case (case 7)
        print("Waiting for C-priority case...")
        for _ in range(30):
            await asyncio.sleep(1)
            content = await page.content()
            if "C priority" in content or "c_priority" in content.lower():
                break
        
        # Screenshot 5: C-priority decision
        print("Screenshot 5: C-priority decision...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/c_priority_decision.png", full_page=False)
        
        # Test mobile view
        print("Testing mobile view...")
        await page.set_viewport_size({"width": 390, "height": 844})
        await asyncio.sleep(1)
        
        # Screenshot 6: Mobile compact overlay
        print("Screenshot 6: Mobile compact overlay...")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/mobile_compact_overlay.png", full_page=False)
        
        # Reset to desktop and check /details
        await page.set_viewport_size({"width": 1920, "height": 1080})
        print(f"\nOpening {BASE_URL}/details...")
        await page.goto(f"{BASE_URL}/details", wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        # Check for errors
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        print("\n=== QA Results ===")
        print(f"Screenshots saved to: {SCREENSHOT_DIR}/")
        for f in sorted(os.listdir(SCREENSHOT_DIR)):
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
