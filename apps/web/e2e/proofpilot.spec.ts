import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

const demoCredentials = {
  email: "nicholas.kerr@proofpilot.test",
  password: "Password123!"
};
const apiHealthUrl =
  process.env.PROOFPILOT_E2E_API_URL ?? "http://localhost:4000/health";

type AccessibilityViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

test.describe("ProofPilot responsive workspace", () => {
  test("public authentication is responsive and accessible", async ({ page }) => {
    await waitForApi(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Sign in" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Sign in" })).toBeVisible();

    await page.getByRole("tab", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Confirm password", { exact: true })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "public authentication");
  });

  test("demo user can navigate the signed-in shell", async ({ page }) => {
    await loginAsDemoUser(page);

    const primaryNavigation = getPrimaryNavigation(page);
    const homeButton = primaryNavigation.getByRole("button", { exact: true, name: "Home" });
    await expect(homeButton).toHaveAttribute("aria-current", "page");
    await expectNavigationTargets(primaryNavigation);

    await page.getByRole("button", { name: "Open account menu" }).click();
    const accountDetails = page.getByRole("region", { name: "Account details" });
    await expect(accountDetails).toContainText("Nicholas Kerr");
    await expect(accountDetails).toContainText(demoCredentials.email);
    await page.keyboard.press("Escape");
    await expect(accountDetails).toBeHidden();

    const casesButton = primaryNavigation.getByRole("button", {
      exact: true,
      name: "Cases"
    });
    await casesButton.click();
    await expect(page.getByRole("heading", { exact: true, name: "Cases" })).toBeVisible();
    await expect(casesButton).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalOverflow(page);

    await homeButton.click();
    await expect(homeButton).toHaveAttribute("aria-current", "page");
    await expectAccessible(page, "signed-in home workspace");
  });
});

async function loginAsDemoUser(page: Page) {
  await waitForApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByLabel("Email address").fill(demoCredentials.email);
  await page.getByLabel("Password", { exact: true }).fill(demoCredentials.password);
  await page.getByRole("button", { exact: true, name: "Sign in" }).click();

  await expect(getPrimaryNavigation(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

async function waitForApi(page: Page) {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(apiHealthUrl)).ok();
        } catch {
          return false;
        }
      },
      {
        message: `Expected the ProofPilot API to be healthy at ${apiHealthUrl}`,
        timeout: 30_000
      }
    )
    .toBe(true);
}

function getPrimaryNavigation(page: Page) {
  const viewportWidth = page.viewportSize()?.width ?? 0;
  return page.getByRole("navigation", {
    name: viewportWidth >= 1024 ? "Primary" : "Primary mobile"
  });
}

async function expectNavigationTargets(navigation: Locator) {
  const targetHeights = await navigation.getByRole("button").evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const style = window.getComputedStyle(button);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((button) => ({
        height: button.getBoundingClientRect().height,
        label: button.textContent?.trim() ?? "unnamed navigation control"
      }))
  );

  for (const target of targetHeights) {
    expect(target.height, `${target.label} should be at least 44px tall`).toBeGreaterThanOrEqual(44);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    contentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(
    dimensions.contentWidth,
    `Page width ${dimensions.contentWidth}px exceeds viewport ${dimensions.viewportWidth}px`
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

async function expectAccessible(page: Page, surface: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations, formatAccessibilityViolations(surface, results.violations)).toEqual(
    []
  );
}

function formatAccessibilityViolations(
  surface: string,
  violations: AccessibilityViolation[]
) {
  if (!violations.length) {
    return `${surface} has no automated accessibility violations.`;
  }

  return [
    `${surface} has ${violations.length} automated accessibility violation(s):`,
    ...violations.map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map(
          (node) =>
            `  - ${node.target.map(String).join(" > ")}: ${
              node.failureSummary ?? "Review this element."
            }`
        )
        .join("\n");

      return `${violation.impact ?? "unknown"} ${violation.id}: ${violation.help}\n${nodes}`;
    })
  ].join("\n\n");
}
