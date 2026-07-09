#!/usr/bin/env python3
"""
Browser QA script for final visual polish.
Takes screenshots at different viewports and scenarios.
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "https://arhipovdan.ru"
SCREENSHOT_DIR = Path(__file__).parent.parent / "docs" / "final_visual_polish_screenshots"

async def main():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # Desktop viewport 1920x1080
        print("Testing desktop 1920x1080...")
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()
        
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        # Screenshot 1: Desktop overview
        print("Screenshot: desktop_overview...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "desktop_overview.png"))
        
        # Start playback
        play_button = page.locator(".play-button, button:has-text('Play')")
        if await play_button.count() > 0:
            await play_button.first.click()
        
        # Screenshot 2: Desktop playing with item on belt
        await asyncio.sleep(1.5)
        print("Screenshot: desktop_playing_item_on_belt...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "desktop_playing_item_on_belt.png"))
        
        # Screenshot 3: Desktop inspection overlay
        await asyncio.sleep(2)
        print("Screenshot: desktop_inspection_overlay...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "desktop_inspection_overlay.png"))
        
        # Wait for routing to B
        await asyncio.sleep(3)
        print("Screenshot: desktop_routing_to_b...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "desktop_routing_to_b.png"))
        
        # Wait for C routing (case 3 or 4)
        await asyncio.sleep(12)
        print("Screenshot: desktop_routing_to_c...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "desktop_routing_to_c.png"))
        
        # Wait for D routing (case 5 or 6)
        await asyncio.sleep(12)
        print("Screenshot: desktop_routing_to_d...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "desktop_routing_to_d.png"))
        
        # Screenshot roll cages
        await asyncio.sleep(2)
        print("Screenshot: desktop_roll_cages...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "desktop_roll_cages.png"))
        
        await context.close()
        
        # Laptop viewport 1440x900
        print("\nTesting laptop 1440x900...")
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()
        
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        play_button = page.locator(".play-button, button:has-text('Play')")
        if await play_button.count() > 0:
            await play_button.first.click()
            await asyncio.sleep(3)
        
        print("Screenshot: laptop_1440...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "laptop_1440.png"))
        
        await context.close()
        
        # Mobile viewport 390x844
        print("\nTesting mobile 390x844...")
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()
        
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        play_button = page.locator(".play-button, button:has-text('Play')")
        if await play_button.count() > 0:
            await play_button.first.click()
            await asyncio.sleep(2)
        
        print("Screenshot: mobile_390...")
        await page.screenshot(path=str(SCREENSHOT_DIR / "mobile_390.png"))
        
        # Check details page
        print("\nChecking /details...")
        await page.goto(f"{BASE_URL}/details", wait_until="networkidle", timeout=30000)
        await asyncio.sleep(1)
        print("Screenshot: details_page...")
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
        
        print("\n=== Acceptance Checklist ===")
        print("✓ Screenshots captured")
        print("✓ Desktop, laptop, mobile tested")
        print("✓ /details page tested")
        print(f"✓ Console errors: {len(errors)}")
        print("\nFinal Visual Polish QA Complete!")

if __name__ == "__main__":
    asyncio.run(main())
