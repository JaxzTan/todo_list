import "dotenv/config";
import { test, expect } from "@playwright/test";

const USER1 = process.env.USER1;
const PASSWORD1 = process.env.PASSWORD1;
if (!USER1 || !PASSWORD1) throw new Error("USER1/PASSWORD1 must be set in .env to run the e2e suite");

const boardTitle = `Playwright run ${Date.now()}`;
const boardSlug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

test("full flow: login, create board, add step, change status, matrix, export", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Handle").fill(USER1);
  await page.getByLabel("Password").fill(PASSWORD1);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page).toHaveURL(/\/boards/);

  await page.getByRole("button", { name: "+ New board" }).click();
  await page.getByLabel("Title").fill(boardTitle);
  await page.getByLabel("Goal").fill("prove the UI works in a real browser");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/boards\/playwright-run-/);
  await expect(page.getByText(boardTitle)).toBeVisible();
  await expect(page.getByText("— board complete")).toBeVisible();

  await page.getByRole("button", { name: "+ Add step" }).click();
  await page.getByPlaceholder("Add step").fill("Prove status changes work");
  await page.getByPlaceholder("Add step").press("Enter");

  await expect(page.getByRole("button", { name: "Prove status changes work" })).toBeVisible();
  // The aside's Next Action card surfaces the same step as the tree row.
  await expect(page.locator("aside .card-title")).toHaveText("Prove status changes work");

  // Both the aside's Next Action card and the tree row show a status pill
  // for the same node (matches the wireframe) — scope to the table so the
  // click lands on one, not the other.
  const table = page.getByRole("table");
  await table.getByRole("button", { name: "Todo" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(table.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect(page.getByText("1/1")).toBeVisible();
  await expect(page.getByText("— board complete")).toBeVisible();

  await page.getByRole("button", { name: "Matrix" }).click();
  // No due date or priority set — lands in the default (Priority 3 / None,
  // "—" due-window) cell rather than a dedicated "Unplaced" tray, since the
  // wireframe's matrix has no free-standing quadrant state (design_change.md
  // decision #2).
  await expect(page.getByText("Prove status changes work", { exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download markdown" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`${boardSlug}.md`);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const markdown = Buffer.concat(chunks).toString("utf-8");
  expect(markdown).toContain(boardTitle);
  expect(markdown).toContain("Prove status changes work");

  await page.getByRole("button", { name: "Download report" }).click();
  await expect(page.getByText("Session #1")).toBeVisible();
  await expect(page.locator("pre")).toContainText("Prove status changes work");

  // Both header toggles show the CURRENT state as their label (matches the
  // wireframe screenshots — "Light"/"EN" are shown while already active,
  // not the switch target).
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByText("树状图")).toBeVisible();
});
