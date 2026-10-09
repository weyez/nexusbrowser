import { expect, test, type Page } from "@playwright/test";

const FIXTURE = (title: string) => `<!doctype html><title>${title}</title><body style="font:20px sans-serif"><h1 id="t">${title}</h1></body>`;

/** Deterministic network: fixture pages for *.test hosts and a controllable embed-check API. */
async function setup(page: Page, blocked: string[] = []) {
  await page.context().route(/^https:\/\/[^/]*\.test\//, (route) => route.fulfill({ contentType: "text/html", body: FIXTURE(new URL(route.request().url()).hostname) }));
  await page.route(/^https:\/\/www\.bing\.com\//, (route) => route.fulfill({ contentType: "text/html", body: FIXTURE("bing results") }));
  await page.route("**/api/embed-check?**", (route) => {
    const url = new URL(route.request().url()).searchParams.get("url") ?? "";
    const isBlocked = blocked.some((b) => url.includes(b));
    return route.fulfill({ json: { verdict: isBlocked ? "blocked" : "allowed", reason: isBlocked ? "x-frame-options" : "ok", finalUrl: url } });
  });
  await page.goto("/");
}

const address = (page: Page) => page.getByRole("textbox", { name: "Address and search bar" });
async function go(page: Page, input: string) {
  await address(page).click();
  await address(page).fill(input);
  await address(page).press("Enter");
}
const frame = (page: Page) => page.locator("main iframe:visible");

test("new tab page shows search and favorites", async ({ page }) => {
  await setup(page);
  await expect(page.getByRole("heading", { name: "NEXUS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wikipedia" })).toBeVisible();
  await expect(page.getByRole("tab", { selected: true })).toContainText("New Tab");
});

test("address bar opens domains and loads them in a real iframe", async ({ page }) => {
  await setup(page);
  await go(page, "alpha.test");
  await expect(frame(page)).toHaveAttribute("src", "https://alpha.test/");
  await expect(page.frameLocator("main iframe:visible").locator("#t")).toHaveText("alpha.test");
  await expect(page.getByRole("tab", { selected: true })).toContainText("alpha.test");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(address(page)).toHaveValue("alpha.test");
});

test("plain text becomes a search", async ({ page }) => {
  await setup(page);
  await go(page, "ipad html5 games");
  await expect(frame(page)).toHaveAttribute("src", "https://www.bing.com/search?q=ipad%20html5%20games");
});

test("blocked sites show an explanation with working actions", async ({ page }) => {
  await setup(page, ["blocked.test"]);
  await go(page, "blocked.test");
  await expect(page.getByRole("heading", { name: /can't be shown inside NEXUS/ })).toBeVisible();
  await expect(page.getByText(/X-Frame-Options/)).toBeVisible();
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open in a normal tab" }).click();
  expect((await popup).url()).toBe("https://blocked.test/");
  await page.getByRole("button", { name: "Try anyway" }).click();
  await expect(frame(page)).toHaveAttribute("src", "https://blocked.test/");
});

test("unsupported schemes are refused", async ({ page }) => {
  await setup(page);
  await go(page, "javascript:alert(1)");
  await expect(page.getByRole("status")).toContainText("can't be opened");
  await expect(page.locator("main iframe")).toHaveCount(0);
});

test("tabs keep independent history and persist across reloads", async ({ page }) => {
  await setup(page);
  await go(page, "one.test");
  await go(page, "two.test");
  await page.getByRole("button", { name: /New tab/ }).click();
  await go(page, "three.test");
  await expect(page.getByRole("tab")).toHaveCount(2);

  await page.getByRole("tab", { name: "two.test" }).click();
  await page.getByRole("button", { name: /^Back/ }).click();
  await expect(frame(page)).toHaveAttribute("src", "https://one.test/");
  await page.getByRole("button", { name: /^Forward/ }).click();
  await expect(frame(page)).toHaveAttribute("src", "https://two.test/");

  await page.waitForTimeout(400); // debounced save
  await page.reload();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(page.getByRole("tab", { selected: true })).toContainText("two.test");
  await page.getByRole("button", { name: /^Back/ }).click();
  await expect(frame(page)).toHaveAttribute("src", "https://one.test/");

  await page.getByRole("button", { name: "Close three.test" }).click();
  await expect(page.getByRole("tab")).toHaveCount(1);
});

test("background tabs are not loaded until opened after a restart", async ({ page }) => {
  await setup(page);
  await go(page, "first.test");
  await page.getByRole("button", { name: /New tab/ }).click();
  await go(page, "second.test");
  await page.waitForTimeout(400);
  await page.reload();
  await expect(frame(page)).toHaveAttribute("src", "https://second.test/");
  await expect(page.locator('main iframe[src="https://first.test/"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "first.test" }).click();
  await expect(frame(page)).toHaveAttribute("src", "https://first.test/");
  await expect(page.locator("main iframe")).toHaveCount(2); // second stays alive in background
});

test("favorites can be added from the toolbar and opened", async ({ page }) => {
  await setup(page);
  await go(page, "fav.test");
  await page.getByRole("button", { name: "Add to favorites" }).click();
  await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
  await page.getByRole("button", { name: /^Home/ }).click().catch(async () => page.keyboard.press("Alt+KeyH"));
  await expect(page.getByRole("button", { name: "fav.test" })).toBeVisible();
});

test("settings: theme persists and the panel closes with Escape", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("hide toolbars mode and restore", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Hide toolbars" }).click();
  await expect(address(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Show toolbars" }).click();
  await expect(address(page)).toBeVisible();
});

test("keyboard shortcuts work on desktop", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "desktop only");
  await setup(page);
  await page.keyboard.press("Alt+KeyT");
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(address(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await page.locator("main").click();
  await page.keyboard.press("Alt+BracketLeft");
  await expect(page.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Alt+KeyW");
  await expect(page.getByRole("tab")).toHaveCount(1);
  await page.keyboard.press("Control+KeyL");
  await expect(address(page)).toBeFocused();
});

test("touch layout: toolbar targets are at least 44px", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch only");
  await setup(page);
  for (const name of [/^Back/, /^Forward/, "Settings", /New tab/]) {
    const box = await page.getByRole("button", { name }).first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test("touch: swiping the toolbar switches tabs", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch only");
  await setup(page);
  await page.getByRole("button", { name: /New tab/ }).click();
  await page.locator("main").click({ position: { x: 5, y: 5 } }).catch(() => {});
  const bar = page.getByRole("button", { name: /^Back/ });
  const box = (await bar.boundingBox())!;
  const y = box.y + box.height / 2;
  // dispatch a touch-pointer swipe to the right (→ previous tab)
  await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)!;
    const opts = (cx: number) => ({ bubbles: true, pointerType: "touch", clientX: cx, clientY: y, isPrimary: true, pointerId: 7 });
    el.dispatchEvent(new PointerEvent("pointerdown", opts(x)));
    el.dispatchEvent(new PointerEvent("pointerup", opts(x + 150)));
  }, { x: box.x + box.width / 2, y });
  await expect(page.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
});
