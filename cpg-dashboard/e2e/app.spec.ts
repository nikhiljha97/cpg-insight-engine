import { expect, test } from "@playwright/test";
import { installUpstreamMocks } from "./api-mocks";

test.beforeEach(async ({ page }) => {
  await installUpstreamMocks(page);
});

test("About loads", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.getByText("CPG Retail Analytics Engine")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});

test("Dashboard: weather + demand category", async ({ page }) => {
  await page.goto("/#/dashboard");
  await expect(page.getByRole("heading", { name: "CPG Analytics Dashboard" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Demand Sensitivity")).toBeVisible();

  const catSelect = page.locator(".cat-select");
  await expect(catSelect).toBeVisible();
  await catSelect.selectOption("Ice Cream");
  await expect(catSelect).toHaveValue("Ice Cream");
  await expect(page.getByText(/Ontario retail · Ice Cream/)).toBeVisible();
  await expect(page.getByText(/Quarterly sales \(M\$ CAD\)/)).toBeVisible();
});

test("Dashboard: macro strip + NLQ beta panel", async ({ page }) => {
  await page.goto("/#/dashboard");
  await expect(page.getByRole("heading", { name: "CPG Analytics Dashboard" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Retail analytics · sampled listings")).toBeVisible();
  await expect(page.getByText(/\$6\.42/)).toBeVisible();
  await expect(page.getByText("Greater Toronto · CPI (unified)")).toBeVisible();
  await expect(page.getByText("Query your data")).toBeVisible();
  await page.getByRole("button", { name: /soup companions/i }).click();
  await expect(page.getByText("UAT copilot")).toBeVisible({ timeout: 20_000 });
});

test("Basket Analysis: category lens and sync from Dashboard", async ({ page }) => {
  await page.goto("/#/dashboard");
  await expect(page.getByRole("heading", { name: "CPG Analytics Dashboard" })).toBeVisible({
    timeout: 30_000,
  });
  await page.locator(".cat-select").selectOption("Pasta & Sauce");

  await page.getByRole("link", { name: "Basket Analysis" }).click();
  await expect(page.getByText("Basket Analysis").first()).toBeVisible();
  const foodCat = page.locator("label").filter({ hasText: "Food category" }).locator("select");
  await expect(foodCat).toHaveValue("Pasta & Sauce");

  await expect(page.getByRole("heading", { name: /Pasta & Sauce basket lens/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Pasta & Sauce basket companions")).toBeVisible();

  await foodCat.selectOption("BBQ Meats");
  await expect(page.getByRole("heading", { name: /BBQ Meats basket lens/i })).toBeVisible({ timeout: 20_000 });
});

test("Promo, Price Elasticity, Demographics, Pitch History", async ({ page }) => {
  await page.goto("/#/promo");
  await expect(page.getByRole("heading", { name: "Promo Attribution" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/#/elasticity");
  await expect(page.getByRole("heading", { name: "Price Elasticity" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/#/demographics");
  await expect(page.getByRole("heading", { name: "Demographic Segments" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/#/history");
  await expect(page.getByRole("heading", { name: "Pitch History" })).toBeVisible({ timeout: 30_000 });
});
