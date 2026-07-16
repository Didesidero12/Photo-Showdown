import asyncio
import os
import urllib.request
import urllib.parse
import json
import base64
from playwright.async_api import async_playwright

SUPABASE_URL = "http://127.0.0.1:54321"
ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Use an incognito context
        context = await browser.new_context()
        page = await context.new_page()
        
        out_dir = "/Users/joeydidesidero/.gemini/antigravity-ide/brain/b4125377-7009-4f77-81b2-a070159f4613/"
        
        # 1. Fetch a valid class code to join
        req = urllib.request.Request(f"{SUPABASE_URL}/auth/v1/token?grant_type=password", 
            data=json.dumps({"email": "m2-teacher@test.local", "password": "password-m2-teacher"}).encode('utf-8'),
            headers={"Content-Type": "application/json", "apikey": ANON_KEY})
        token = json.loads(urllib.request.urlopen(req).read())['access_token']
        
        req2 = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/classes?select=class_code&limit=1", 
            headers={"apikey": ANON_KEY, "Authorization": f"Bearer {token}"})
        classes = json.loads(urllib.request.urlopen(req2).read())
        valid_class_code = classes[0]['class_code']

        # 2. Open /join
        await page.goto("http://localhost:3000/join")
        await page.wait_for_selector("#student-join-form")
        
        # 3. Enter details and submit
        await page.fill("#display-name", "Incognito Student")
        await page.fill("#class-code", valid_class_code)
        
        # Capture pre-submit state
        await page.screenshot(path=os.path.join(out_dir, "join_pre_submit.png"))
        
        # Submit
        await page.click("#join-class-submit-btn")
        
        # 4. Wait for redirect to /my/[classId]
        await page.wait_for_url(r"**/my/**", timeout=10000)
        
        print(f"Redirected to: {page.url}")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=os.path.join(out_dir, "join_post_submit_redirect.png"))
        
        # 5. Look at cookies to find the anonymous session user ID
        cookies = await context.cookies()
        auth_cookie = next((c for c in cookies if "-auth-token" in c['name']), None)
        
        user_id = None
        if auth_cookie:
            try:
                decoded = urllib.parse.unquote(auth_cookie['value'])
                parts = json.loads(decoded)
                access_token = parts[0]
                payload = access_token.split('.')[1]
                payload += '=' * (-len(payload) % 4)
                user_id = json.loads(base64.b64decode(payload).decode('utf-8'))['sub']
                print(f"User ID from cookie: {user_id}")
            except Exception as e:
                print(f"Could not parse cookie: {e}")

        # 6. Refresh the page
        print("Refreshing page...")
        await page.reload()
        await page.wait_for_load_state("networkidle")
        
        # 7. Check if cookie is still there and valid
        cookies2 = await context.cookies()
        auth_cookie2 = next((c for c in cookies2 if "-auth-token" in c['name']), None)
        if auth_cookie2:
            print("Cookie persists after refresh.")
            
        await page.screenshot(path=os.path.join(out_dir, "join_post_refresh.png"))
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
