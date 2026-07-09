#!/usr/bin/env python3
"""
Browser QA script for cinematic camera.
Takes screenshots at different camera angles during playback.
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "https://arhipovdan.ru"
SCREENSHOT_DIR = Path(__file__).parent.parent / "docs" / "cinematic_camera_screenshots"

async def main():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # Desktop viewport
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()
        
        # Collect console errors
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        print("Loading production site...")
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        # Screenshot 1: Overview (initial state)
        print("Screenshot: overview...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "overview.png"))
        
        # Start playback
        print("Starting playback...")
        play_button = page.locator(".play-button, button:has-text('Play')")
        if await play_button.count() > 0:
            await play_button.first.click()
        
        # Screenshot 2: Feed closeup (spawn phase)
        await asyncio.sleep(0.5)
        print("Screenshot: feed_closeup (spawn)...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "feed_closeup.png"))
        
        # Screenshot 3: Inspection top (detection phase)
        await asyncio.sleep(1.5)
        print("Screenshot: inspection_top (detection)...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "inspection_top.png"))
        
        # Screenshot 4: Measurement side (measurement phase)
        await asyncio.sleep(0.8)
        print("Screenshot: measurement_side (measurement)...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "measurement_side.png"))
        
        # Screenshot 5: Routing wide (command sent + routing)
        await asyncio.sleep(1.5)
        print("Screenshot: routing_wide (routing)...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "routing_wide.png"))
        
        # Screenshot 6: Chute closeup (during routing)
        await asyncio.sleep(0.5)
        print("Screenshot: chute_closeup...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "chute_closeup.png"))
        
        # Screenshot 7: Result zone (exit phase)
        await asyncio.sleep(1.0)
        print("Screenshot: result_zone (exit)...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "result_zone.png"))
        
        # Wait for a few more cases to see C/D routing
        print("Waiting for C/D routing cases...")
        await asyncio.sleep(15)
        await page.screenshot(path=str(SCREENSHOT_DIR / "c_routing.png"))
        
        await asyncio.sleep(10)
        await page.screenshot(path=str(SCREENSHOT_DIR / "d_routing.png"))
        
        # Screenshot 8: Mobile viewport
        print("Testing mobile viewport...")
        await context.close()
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()
        
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        # Start playback on mobile
        play_button = page.locator(".play-button, button:has-text('Play')")
        if await play_button.count() > 0:
            await play_button.first.click()
            await asyncio.sleep(3)
        
        await page.screenshot(path=str(SCREENSHOT_DIR / "mobile_view.png"))
        
        # Check details page
        print("Checking /details...")
        await page.goto(f"{BASE_URL}/details", wait_until="networkidle", timeout=30000)
        await asyncio.sleep(1)
        await page.screenshot(path=str(SCREENSHOT_DIR / "details_page.png"))
        
        await context.close()
        await browser.close()
        
        # Report
        print(f"\nScreenshots saved to: {SCREENSHOT_DIR}")
        if errors:
            print(f"\nConsole errors found ({len(errors)}):")
            for e in errors[:10]:
                print(f"  - {e[:100]}")
        else:
            print("\nNo console errors found.")
        
        print("\nCinematic Camera QA Complete!")

if __name__ == "__main__":
    asyncio.run(main())
