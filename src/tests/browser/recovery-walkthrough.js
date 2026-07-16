const puppeteer = require('puppeteer');
const fs = require('fs');

const ARTIFACTS_DIR = '/Users/joeydidesidero/.gemini/antigravity-ide/brain/b4125377-7009-4f77-81b2-a070159f4613';
const APP_URL = 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  try {
    // Session 1: Original Student
    const ctx1 = await browser.createBrowserContext();
    const page1 = await ctx1.newPage();
    await page1.setViewport({ width: 1280, height: 800 });

    // Session 2: Replacement Student
    const ctx2 = await browser.createBrowserContext();
    const page2 = await ctx2.newPage();
    await page2.setViewport({ width: 1280, height: 800 });

    // Session 3: Teacher
    const ctxTeacher = await browser.createBrowserContext();
    const pageTeacher = await ctxTeacher.newPage();
    await pageTeacher.setViewport({ width: 1280, height: 800 });

    // 1. Teacher Setup (using API shortcut for speed, or UI if prefer)
    // We'll create a class via DB to guarantee it's ready, or we can just log in
    // Wait, it's easier to create a class in DB using Supabase admin in a test file, or just use UI.
    // Actually, I can just use the UI if I sign up a teacher.
    await pageTeacher.goto(`${APP_URL}/auth/sign-in`);
    await pageTeacher.type('input[type="email"]', 'walkthrough-teacher@test.local');
    await pageTeacher.type('input[type="password"]', 'password123');
    await pageTeacher.click('button[type="submit"]');
    await pageTeacher.waitForNavigation();

    // Since we don't have sign up implemented easily for tests without clicking links, 
    // it's much better to just rely on the existing seeded class from our DB reset!
    // DB reset seeded a teacher "teacher@example.com", "password123".
    
    // Let's use the seeded teacher!
    console.log("Teacher logging in...");
    await pageTeacher.goto(`${APP_URL}/auth/sign-in`);
    await pageTeacher.type('input[type="email"]', 'teacher@example.com');
    await pageTeacher.type('input[type="password"]', 'password123');
    await pageTeacher.click('button[type="submit"]');
    await pageTeacher.waitForSelector('text=Classes', { timeout: 10000 });

    // Teacher finds a class and code
    await pageTeacher.goto(`${APP_URL}/classes`);
    await pageTeacher.waitForSelector('a[href^="/classes/"]');
    const classLink = await pageTeacher.$('a[href^="/classes/"]');
    await classLink.click();
    await pageTeacher.waitForSelector('#class-code-display');
    const classCode = await pageTeacher.$eval('#class-code-display', el => el.innerText.trim());
    console.log("Class code:", classCode);

    // 2. Original Student joins
    console.log("Original student joining...");
    await page1.goto(`${APP_URL}/join`);
    await page1.type('#display-name', 'Original Student');
    await page1.type('#class-code', classCode);
    await page1.click('#join-class-submit-btn');
    await page1.waitForNavigation();
    
    // Original Student takes screenshot of their /my dashboard
    await page1.goto(`${APP_URL}/my`);
    await page1.waitForSelector('text=Welcome back');
    await page1.screenshot({ path: `${ARTIFACTS_DIR}/recovery_01_original_student.png` });

    // 3. Teacher goes to students and generates recovery code
    console.log("Teacher generating recovery code...");
    const url = pageTeacher.url();
    await pageTeacher.goto(`${url}/students`);
    await pageTeacher.waitForSelector('text=Original Student');
    await pageTeacher.screenshot({ path: `${ARTIFACTS_DIR}/recovery_02_teacher_roster.png` });

    // Click generate recovery code for Original Student
    await pageTeacher.evaluate(() => {
      // Find the button inside the row for Original Student
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows.find(r => r.innerText.includes('Original Student'));
      const btn = row.querySelector('button');
      btn.click();
    });
    
    await pageTeacher.waitForFunction(() => {
      return document.body.innerText.includes('Give this code to');
    });
    
    await pageTeacher.screenshot({ path: `${ARTIFACTS_DIR}/recovery_03_teacher_code.png` });

    const recoveryCode = await pageTeacher.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows.find(r => r.innerText.includes('Original Student'));
      return row.querySelector('strong').innerText.trim();
    });
    console.log("Recovery code:", recoveryCode);

    // 4. Replacement Student claims the code
    console.log("Replacement student claiming code...");
    await page2.goto(`${APP_URL}/recover`);
    await page2.type('#recoveryCode', recoveryCode);
    await page2.click('button[type="submit"]');
    
    await page2.waitForSelector('text=Access Restored');
    await page2.screenshot({ path: `${ARTIFACTS_DIR}/recovery_04_restored.png` });

    // Replacement session sees existing class on /my
    await page2.goto(`${APP_URL}/my`);
    await page2.waitForSelector('text=Welcome back, Original Student');
    await page2.screenshot({ path: `${ARTIFACTS_DIR}/recovery_05_new_device.png` });

    // 5. Original session loses access
    console.log("Checking old session...");
    await page1.reload();
    await page1.waitForNavigation(); // should redirect to /join since they lost the only membership
    await page1.screenshot({ path: `${ARTIFACTS_DIR}/recovery_06_old_device_redirect.png` });

    // 6. The recovery code cannot be reused
    console.log("Trying to reuse code...");
    await page1.goto(`${APP_URL}/recover`);
    await page1.type('#recoveryCode', recoveryCode);
    await page1.click('button[type="submit"]');
    await page1.waitForSelector('text=Invalid or expired recovery code', { timeout: 10000 });
    await page1.screenshot({ path: `${ARTIFACTS_DIR}/recovery_07_reuse_failed.png` });

    console.log("Walkthrough complete!");
  } catch (err) {
    console.error("Error during walkthrough:", err);
  } finally {
    await browser.close();
  }
})();
