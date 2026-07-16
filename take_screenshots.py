import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # 1. Join Page
        await page.goto("http://localhost:3000/join")
        await page.wait_for_selector("#student-join-form")
        
        out_dir = "/Users/joeydidesidero/.gemini/antigravity-ide/brain/b4125377-7009-4f77-81b2-a070159f4613/"
        await page.screenshot(path=os.path.join(out_dir, "student_join_page.png"))
        
        # 2. Join Page Error State
        await page.fill("#display-name", "Alice")
        await page.fill("#class-code", "BADC0D")
        await page.click("#join-class-submit-btn")
        
        # Wait for error message
        await page.wait_for_selector("p[role='alert']")
        await page.screenshot(path=os.path.join(out_dir, "student_join_error.png"))

        # 3. Successful Join flow
        # Get actual class code from env or DB... wait, I can just use a real class code.
        # But wait, python script can't get class code easily without importing something.
        # Let's pass it via command line args.
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
