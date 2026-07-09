#!/usr/bin/env python3
"""
Browser QA script for physical realism fixes.
Takes screenshots of production to verify:
- STL models displayed
- Items on belt at correct scale
- Sensors above items
- Speed synchronized
- Roll cages for C/D
- No HUD/overlay overlap
"""

import asyncio
import time
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "https://arhipovdan.ru"
SCREENSHOT_DIR = Path(__file__).parent.parent / "docs" / "physical_realism_fix_screenshots"

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
        
        # Screenshot 1: Initial idle state
        print("Screenshot: initial idle state...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "initial_idle.png"))
        
        # Start playback
        print("Starting playback...")
        play_button = page.locator(".demo-play-btn, button:has-text('Play'), button:has-text('Запустить')")
        if await play_button.count() > 0:
            await play_button.first.click()
            await asyncio.sleep(0.5)
        
        # Screenshot 2: Real STL item (after short delay for model load)
        print("Screenshot: STL item...")
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOT_DIR / "real_stl_item.png"))
        
        # Screenshot 3: Item on belt scale
        print("Screenshot: item on belt scale...")
        await asyncio.sleep(1)
        await page.screenshot(path=str(SCREENSHOT_DIR / "item_on_belt_scale.png"))
        
        # Screenshot 4: Sensor above item
        print("Screenshot: sensor above item...")
        await asyncio.sleep(1)
        await page.screenshot(path=str(SCREENSHOT_DIR / "sensor_above_item.png"))
        
        # Screenshot 5: Speed sync t=0
        print("Screenshot: speed sync t0...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "speed_sync_t0.png"))
        
        # Screenshot 6: Speed sync t=1 (after 1 second)
        await asyncio.sleep(1)
        print("Screenshot: speed sync t1...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "speed_sync_t1.png"))
        
        # Wait for routing phase
        print("Waiting for routing phase...")
        await asyncio.sleep(5)
        
        # Screenshot 7: Route to C (need to find a C case)
        print("Screenshot: route scenarios...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "route_active.png"))
        
        # Continue playback to see C/D roll cages
        await asyncio.sleep(8)
        await page.screenshot(path=str(SCREENSHOT_DIR / "c_roll_cage.png"))
        
        await asyncio.sleep(8)
        await page.screenshot(path=str(SCREENSHOT_DIR / "d_roll_cage.png"))
        
        # Screenshot 8: No overlay overlap
        print("Screenshot: overlay no overlap...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "overlay_no_overlap.png"))
        
        # Mobile viewport
        print("Testing mobile viewport...")
        await context.close()
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()
        
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        # Start playback on mobile
        play_button = page.locator(".demo-play-btn, button:has-text('Play'), button:has-text('Запустить')")
        if await play_button.count() > 0:
            await play_button.first.click()
            await asyncio.sleep(3)
        
        await page.screenshot(path=str(SCREENSHOT_DIR / "mobile_overlay.png"))
        
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
        
        print("\nQA Complete!")

if __name__ == "__main__":
    asyncio.run(main())
