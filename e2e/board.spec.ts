import "dotenv/config";
import { test, expect } from "@playwright/test";

const TOKEN = process.env.PAT_JAXZ;
if (!TOKEN) throw new Error("PAT_JAXZ must be set in .env to run the e2e suite");

const boardTitle = `Playwright run ${Date.now()}`;
const boardSlug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

test("full flow: login, create board, add step, change status, matrix, export", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("ebpat_...").fill(TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/boards/);
  await expect(page.getByRole("main").getByText("No boards yet")).toBeVisible();

  await page.getByRole("button", { name: "+ New board" }).click();
  await page.getByLabel("Title").fill(boardTitle);
  await page.getByLabel("Goal").fill("prove the UI works in a real browser");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/boards\/playwright-run-/);
  await expect(page.getByRole("heading", { name: boardTitle })).toBeVisible();
  await expect(page.getByText("— board complete")).toBeVisible();

  await page.getByRole("button", { name: "+ Add step" }).click();
  await page.getByPlaceholder("Add step").fill("Prove status changes work");
  await page.getByPlaceholder("Add step").press("Enter");

  await expect(page.getByRole("button", { name: "Prove status changes work" })).toBeVisible();
  await expect(page.locator("text=Next action:").locator("..")).toContainText(
    "Prove status changes work",
  );

  await page.getByRole("button", { name: "Todo" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect(page.getByText("1/1")).toBeVisible();
  await expect(page.getByText("— board complete")).toBeVisible();

  await page.getByRole("button", { name: "4-quadrant plan" }).click();
  await expect(page.getByText("Unplaced")).toBeVisible();
  await page.getByRole("button", { name: "Prove status changes work" }).click();
  await expect(page.getByText("Do now").locator("..").locator("..")).toContainText(
    "Prove status changes work",
  );

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

  await page.getByRole("button", { name: "☾" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.getByText("三层看板")).toBeVisible();
});
