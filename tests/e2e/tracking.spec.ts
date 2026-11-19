import { expect, test } from "@playwright/test";

test("tracks a landing signup and attributes an affiliate", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-form").locator('input[name="email"]').fill("harry@localhost");
  await page.getByTestId("login-form").locator('input[name="password"]').fill("growth-engine-local");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "What you can act on." })).toBeVisible();

  await page.goto("/try");
  await expect(page.locator("#ge-variant")).toHaveText(/A|B/);
  await page.getByTestId("signup-form").locator('input[name="name"]').fill("Ada");
  await page.getByTestId("signup-form").locator('input[name="email"]').fill("ada@example.test");
  await page.getByTestId("signup-form").getByRole("button", { name: "Record a test signup" }).click();
  await expect(page.getByText("Saved in this Growth Engine only")).toBeVisible();

  await page.goto("/tracking");
  await expect(page.getByText("signup").first()).toBeVisible();

  await page.goto("/affiliates");
  await page.locator('input[name="name"]').fill("Camera partner");
  await page.locator('input[name="code"]').fill("camera");
  await page.getByRole("button", { name: "Create affiliate" }).click();
  await expect(page.getByRole("heading", { name: "Camera partner · CAMERA" })).toBeVisible();

  await page.goto("/r/camera");
  await expect(page).toHaveURL(/\/try/);
  await page.getByTestId("signup-form").locator('input[name="name"]').fill("Bea");
  await page.getByTestId("signup-form").locator('input[name="email"]').fill("bea@example.test");
  await page.getByTestId("signup-form").getByRole("button", { name: "Record a test signup" }).click();
  await page.goto("/affiliates");
  await expect(page.getByText(/Clicks [1-9]/)).toBeVisible();
});
