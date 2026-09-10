import "dotenv/config";
import { test, expect, request } from "@playwright/test";

const PAT_JAXZ = process.env.PAT_JAXZ;
const PAT_JAYCI = process.env.PAT_JAYCI;
if (!PAT_JAXZ) throw new Error("PAT_JAXZ must be set in .env to run the e2e suite");
if (!PAT_JAYCI) throw new Error("PAT_JAYCI must be set in .env to run the e2e suite");

test("login via App-layer PAT", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("ebpat_...").fill(PAT_JAXZ);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/boards/);
});

test("login via handle + password", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Handle + password" }).click();
  await page.getByLabel("Handle").fill("jaxz");
  await page.getByLabel("Password").fill("Helloworld123.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/boards/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Handle + password" }).click();
  await page.getByLabel("Handle").fill("jaxz");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That handle/password combination wasn't accepted.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("PAT is scoped to one tenant — cross-tenant reads 404", async ({ baseURL }) => {
  const jaxz = await request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${PAT_JAXZ}` } });
  const jayci = await request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${PAT_JAYCI}` } });

  const slug = `cross-tenant-${Date.now()}`;
  const created = await jayci.post("/api/boards", {
    data: { slug, type: "PROJECT", title: "jayci private board", goal: "cross-tenant isolation check" },
  });
  expect(created.ok()).toBeTruthy();

  // Owner can read their own board.
  const ownRead = await jayci.get(`/api/boards/${slug}`);
  expect(ownRead.status()).toBe(200);

  // A different tenant's PAT gets 404, not 403 — existence isn't leaked.
  const crossRead = await jaxz.get(`/api/boards/${slug}`);
  expect(crossRead.status()).toBe(404);

  await jaxz.dispose();
  await jayci.dispose();
});
