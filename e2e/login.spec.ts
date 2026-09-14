import "dotenv/config";
import { test, expect, request } from "@playwright/test";

const { USER1, PASSWORD1, USER2, PASSWORD2 } = process.env;
if (!USER1 || !PASSWORD1 || !USER2 || !PASSWORD2) {
  throw new Error("USER1/PASSWORD1 and USER2/PASSWORD2 must be set in .env to run the e2e suite");
}

async function sessionFor(baseURL: string | undefined, handle: string, password: string) {
  const anon = await request.newContext({ baseURL });
  const res = await anon.post("/api/auth/login", { data: { handle, password } });
  expect(res.ok()).toBeTruthy();
  const { token } = (await res.json()) as { token: string };
  await anon.dispose();
  return request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

test("login via handle + password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Handle").fill(USER1);
  await page.getByLabel("Password").fill(PASSWORD1);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/boards/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Handle").fill(USER1);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("That handle/password combination wasn't accepted.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a session is scoped to one tenant — cross-tenant reads 404", async ({ baseURL }) => {
  const jaxz = await sessionFor(baseURL, USER1, PASSWORD1);
  const jayci = await sessionFor(baseURL, USER2, PASSWORD2);

  const slug = `cross-tenant-${Date.now()}`;
  const created = await jayci.post("/api/boards", {
    data: { slug, type: "PROJECT", title: "jayci private board", goal: "cross-tenant isolation check" },
  });
  expect(created.ok()).toBeTruthy();

  // Owner can read their own board.
  const ownRead = await jayci.get(`/api/boards/${slug}`);
  expect(ownRead.status()).toBe(200);

  // A different tenant's session gets 404, not 403 — existence isn't leaked.
  const crossRead = await jaxz.get(`/api/boards/${slug}`);
  expect(crossRead.status()).toBe(404);

  await jaxz.dispose();
  await jayci.dispose();
});
