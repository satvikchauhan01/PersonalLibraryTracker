import { test, expect } from '@playwright/test';

// Phase 14 e2e — the roadmap's own scope for this flow is:
//   register → add a book → rate it → send a friend request →
//   subscribe (test mode) → Pro badge appears
// The "subscribe" step is skipped here (see the annotated test.skip() at the
// bottom): Razorpay Checkout is a real external iframe that talks to
// Razorpay's own servers, and this project — same as Phases 09/12's other
// Razorpay/Cloudinary/Resend gaps — has no real Razorpay account configured.
// Automating a live Checkout would need real test-mode credentials the user
// hasn't added yet; the payment code itself is covered separately by
// server/tests/webhook.test.js's self-signed-payload idempotency test.

const uniqueEmail = (label) => `e2e-${label}-${Date.now()}@example.com`;

const registerUser = async (page, { name, email, password }) => {
  await page.goto('/auth');
  await page.getByText('Sign Up', { exact: true }).click();
  await page.getByPlaceholder('Satvik Chauhan').fill(name);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Min 6 characters').fill(password);
  await page.getByPlaceholder('Re-enter your password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Skip for now').click();
  await expect(page.getByText('My Reading Stats')).toBeVisible({ timeout: 10000 });
};

test.describe('Signup → add a book → rate it → friend request', () => {
  test('a new user can add a book, rate it, and friend another user', async ({ browser }) => {
    const password = 'password123';
    const userA = { name: 'E2E Alice', email: uniqueEmail('alice'), password };
    const userB = { name: 'E2E Bob', email: uniqueEmail('bob'), password };

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // ── Register both users ──────────────────────────────────────────────
    await registerUser(pageA, userA);
    await registerUser(pageB, userB);

    // ── User A: add a book ───────────────────────────────────────────────
    await pageA.getByRole('button', { name: /Add New Book/i }).click();
    await pageA.locator('#title').fill('The Pragmatic Programmer');
    await pageA.locator('#author').fill('David Thomas');
    await pageA.getByRole('button', { name: 'Add Book' }).click();
    await expect(pageA.getByText('The Pragmatic Programmer')).toBeVisible({ timeout: 10000 });

    // ── User A: rate it ───────────────────────────────────────────────────
    // Keyboard activation (not a mouse click) deliberately — StarRating's
    // half-star hit-testing reads pointer position on a real click, which is
    // precision-sensitive on a ~15px target; a keyboard-triggered click
    // (detail === 0) bypasses that and always resolves to the whole star,
    // which also happens to exercise the Phase 05 accessibility path.
    const fourStars = pageA.getByRole('radio', { name: 'Rate 4 out of 5 stars' });
    await fourStars.focus();
    await fourStars.press('Enter');
    await expect(fourStars).toHaveAttribute('aria-checked', 'true');

    // ── User A: send a friend request to User B ─────────────────────────
    await pageA.getByRole('link', { name: /Friends/i }).click();
    await pageA.getByPlaceholder('Find friends by name or email...').fill(userB.email);
    await expect(pageA.getByText(userB.name)).toBeVisible({ timeout: 10000 });
    await pageA.getByRole('button', { name: /Add/i }).click();
    await expect(pageA.getByText('Pending')).toBeVisible();

    // ── User B: sees the incoming request in the notification bell ──────
    await pageB.getByRole('button', { name: 'Notifications' }).click();
    await expect(pageB.getByText(userA.name)).toBeVisible({ timeout: 10000 });

    await contextA.close();
    await contextB.close();
  });

  // Deferred — see the module-level comment above.
  test.skip('subscribing to Library Pro (test-mode Razorpay Checkout) shows the Pro badge', () => {});
});
