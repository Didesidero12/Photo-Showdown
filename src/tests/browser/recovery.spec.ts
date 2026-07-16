import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Recovery Walkthrough', () => {
  test('Complete Recovery Flow', async ({ browser }) => {
    test.setTimeout(60000); // 1 min timeout
    const APP_URL = 'http://localhost:3000';
    const ARTIFACTS_DIR = '/Users/joeydidesidero/.gemini/antigravity-ide/brain/b4125377-7009-4f77-81b2-a070159f4613';

    // Context 1: Original Student
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();

    // Context 2: Replacement Student
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();

    // Context 3: Teacher
    const ctxTeacher = await browser.newContext();
    const pageTeacher = await ctxTeacher.newPage();

    // 1. Teacher Setup (using test backdoor login)
    console.log("Teacher logging in...");
    await pageTeacher.goto(`${APP_URL}/api/test-login`);
    await pageTeacher.waitForURL('**/classes');
    
    // Teacher finds a class and code
    await pageTeacher.goto(`${APP_URL}/classes`);
    const classLink = pageTeacher.locator('a[href^="/classes/"]').first();
    await classLink.click();
    await pageTeacher.waitForSelector('#class-code-display');
    const classCode = await pageTeacher.locator('#class-code-display').innerText();
    console.log("Class code:", classCode);

    // 2. Original Student joins
    console.log("Original student joining...");
    await page1.goto(`${APP_URL}/join`);
    await page1.fill('#display-name', 'Original Student');
    await page1.fill('#class-code', classCode);
    await page1.click('#join-class-submit-btn');
    await page1.waitForURL('**/my*');
    
    // Original Student takes screenshot of their /my dashboard
    await page1.screenshot({ path: `${ARTIFACTS_DIR}/recovery_01_original_student.png` });

    // 3. Teacher goes to students and generates recovery code
    console.log("Teacher generating recovery code...");
    const url = pageTeacher.url();
    await pageTeacher.goto(`${url}/students`);
    await pageTeacher.waitForSelector('text=Original Student');
    
    // Take a screenshot before generating code
    await pageTeacher.screenshot({ path: `${ARTIFACTS_DIR}/recovery_02_teacher_roster.png` });

    // Click generate recovery code for Original Student
    const generateBtn = pageTeacher.locator('tr:has-text("Original Student") >> button:has-text("Generate Recovery Code")');
    
    // Accept confirm dialog automatically
    pageTeacher.on('dialog', dialog => dialog.accept());
    await generateBtn.click();
    
    await pageTeacher.waitForSelector('text=Give this code to');
    await pageTeacher.screenshot({ path: `${ARTIFACTS_DIR}/recovery_03_teacher_code.png` });

    const recoveryCode = await pageTeacher.locator('tr:has-text("Original Student") >> strong').innerText();
    console.log("Recovery code:", recoveryCode);

    // 4. Replacement Student claims the code
    console.log("Replacement student claiming code...");
    await page2.goto(`${APP_URL}/recover`);
    await page2.fill('#recoveryCode', recoveryCode);
    await page2.click('button[type="submit"]');
    
    await page2.waitForSelector('text=Access Restored');
    await page2.screenshot({ path: `${ARTIFACTS_DIR}/recovery_04_restored.png` });

    // Replacement session sees existing class on /my
    await page2.click('button:has-text("Continue to My Classes")');
    await page2.waitForURL('**/my');
    await page2.waitForSelector('text=Welcome back, Original Student');
    await page2.screenshot({ path: `${ARTIFACTS_DIR}/recovery_05_new_device.png` });

    // 5. Original session loses access
    console.log("Checking old session...");
    await page1.reload();
    await page1.waitForURL('**/join'); // should redirect to /join since they lost the only membership
    await page1.screenshot({ path: `${ARTIFACTS_DIR}/recovery_06_old_device_redirect.png` });

    // 6. The recovery code cannot be reused
    console.log("Trying to reuse code...");
    await page1.goto(`${APP_URL}/recover`);
    await page1.fill('#recoveryCode', recoveryCode);
    await page1.click('button[type="submit"]');
    await page1.waitForSelector('text=Invalid or expired recovery code', { timeout: 10000 });
    await page1.screenshot({ path: `${ARTIFACTS_DIR}/recovery_07_reuse_failed.png` });

    console.log("Walkthrough complete!");
  });
});
