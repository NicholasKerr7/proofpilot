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
    await expect(page.getByText("Processed", { exact: true }).first()).toBeVisible();

    const invalidResourceResponse = await page.request.get("/api/cases/case.id");
    expect(invalidResourceResponse.status()).toBe(400);
    await expect(invalidResourceResponse.json()).resolves.toMatchObject({
      message: expect.stringContaining("Resource id must be")
    });

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

    await navigateToReports(page);
    await expect(page.getByRole("heading", { name: "Reports & analytics" })).toBeVisible();

    if ((page.viewportSize()?.width ?? 0) < 768) {
      for (const metric of [
        "Open cases",
        "Evidence uploaded",
        "Missing evidence",
        "Upcoming deadlines",
        "Packets generated",
        "Failed processing"
      ]) {
        await expect(page.getByText(metric, { exact: true }).last()).toBeVisible();
      }
    } else {
      await expect(
        page.getByRole("heading", {
          exact: true,
          level: 2,
          name: "Completion overview"
        })
      ).toBeVisible();
    }

    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "reports analytics workspace");
  });

  test("demo user can add, edit, reorder, and delete a timeline event", async ({ page }) => {
    await loginAsDemoUser(page);

    await getPrimaryNavigation(page)
      .getByRole("button", { exact: true, name: "Cases" })
      .click();
    await page
      .getByRole("button", { name: /PayPal account closure appeal/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { exact: true, name: "PayPal account closure appeal" })
    ).toBeVisible();

    const timeline = page.locator("#case-timeline");
    const eventTitle = `Timeline verification ${Date.now()}`;
    const updatedTitle = `${eventTitle} updated`;
    await timeline.scrollIntoViewIfNeeded();
    await timeline.getByRole("button", { exact: true, name: "Add event" }).first().click();

    const addEditor = timeline.locator("#timeline-event-editor");
    await addEditor.getByLabel("Date", { exact: true }).fill("2099-07-20");
    await addEditor.getByLabel("Event", { exact: true }).fill(eventTitle);
    await addEditor
      .getByLabel("Details", { exact: true })
      .fill("Created by the responsive timeline test.");
    await addEditor.getByRole("button", { exact: true, name: "Add event" }).click();

    await expect(timeline.getByText(eventTitle, { exact: true })).toBeVisible();
    let eventRow = timeline.getByRole("listitem").filter({ hasText: eventTitle });
    await eventRow.getByRole("button", { name: `Edit ${eventTitle}` }).click();

    const editEditor = eventRow.locator("#timeline-event-editor");
    await editEditor.getByLabel("Event", { exact: true }).fill(updatedTitle);
    const saveEventButton = editEditor.getByRole("button", {
      exact: true,
      name: "Save event"
    });
    await saveEventButton.evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest" });
    });
    await expect(saveEventButton).toBeInViewport();
    await saveEventButton.click();

    await expect(timeline.getByText(updatedTitle, { exact: true })).toBeVisible();
    eventRow = timeline.getByRole("listitem").filter({ hasText: updatedTitle });

    const beforeMove = await timeline.getByRole("listitem").allTextContents();
    const beforeIndex = beforeMove.findIndex((text) => text.includes(updatedTitle));
    await eventRow.getByRole("button", { name: `Move ${updatedTitle} up` }).click();
    await expect
      .poll(async () => {
        const afterMove = await timeline.getByRole("listitem").allTextContents();
        return afterMove.findIndex((text) => text.includes(updatedTitle));
      })
      .toBe(beforeIndex - 1);

    eventRow = timeline.getByRole("listitem").filter({ hasText: updatedTitle });
    await eventRow.getByRole("button", { name: `Delete ${updatedTitle}` }).click();
    const confirmation = eventRow.getByText("Delete this timeline event?", { exact: true });

    if (await confirmation.isVisible().catch(() => false)) {
      await eventRow.getByRole("button", { exact: true, name: "Delete" }).click();
    }

    await expect(timeline.getByText(updatedTitle, { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("demo user can complete and reopen a checklist item", async ({ page }) => {
    await loginAsDemoUser(page);

    await getPrimaryNavigation(page)
      .getByRole("button", { exact: true, name: "Cases" })
      .click();
    await page
      .getByRole("button", { name: /PayPal account closure appeal/ })
      .first()
      .click();

    const checklist = page.locator("#evidence-checklist");
    await checklist.scrollIntoViewIfNeeded();
    await checklist
      .getByRole("button", { name: /Account ownership proof/ })
      .click();

    await checklist.getByRole("button", { exact: true, name: "Mark complete" }).click();
    await expect(checklist.getByText("Checklist item marked complete.")).toBeVisible();
    await expect(
      checklist.getByRole("button", { exact: true, name: "Reopen item" })
    ).toBeVisible();

    await checklist.getByRole("button", { exact: true, name: "Reopen item" }).click();
    await expect(checklist.getByText("Checklist item reopened.")).toBeVisible();
    await expect(
      checklist.getByRole("button", { exact: true, name: "Mark complete" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("demo user can complete the guided statement and restore a version", async ({ page }) => {
    await loginAsDemoUser(page);

    await getPrimaryNavigation(page)
      .getByRole("button", { exact: true, name: "Cases" })
      .click();
    await page
      .getByRole("button", { name: /PayPal account closure appeal/ })
      .first()
      .click();

    const statementBuilder = page.locator("#statement-builder");
    await statementBuilder.scrollIntoViewIfNeeded();
    const answer = `PayPal permanently limited the demo account during verification ${Date.now()}.`;
    await statementBuilder
      .getByLabel("What platform closed or restricted your account?")
      .fill(answer);
    await statementBuilder.getByRole("button", { exact: true, name: "Save answers" }).click();
    await expect(statementBuilder.getByText("Guided answers saved.")).toBeVisible();

    await statementBuilder.getByRole("button", { exact: true, name: "Generate draft" }).click();
    await expect(
      statementBuilder.getByText("Statement draft generated and saved as a new version.")
    ).toBeVisible();
    const draftStatement = statementBuilder.getByLabel("Draft statement");
    await expect(draftStatement).toHaveValue(
      /PayPal permanently limited the demo account/
    );
    const generatedContent = await draftStatement.inputValue();
    await draftStatement.fill(`${generatedContent} Unsaved edit`);
    await expect(
      statementBuilder.getByRole("button", { exact: true, name: "Generate draft" })
    ).toBeDisabled();
    await draftStatement.fill(generatedContent);

    await statementBuilder.getByRole("button", { exact: true, name: "Refresh summary" }).click();
    await expect(
      statementBuilder.getByText("Case summary generated from the saved record.")
    ).toBeVisible();

    await statementBuilder.getByRole("button", { name: /Restore version/ }).first().click();
    await expect(
      statementBuilder.getByText("Statement version restored as the current version.")
    ).toBeVisible();

    const packetExport = page.locator("#packet-export");
    await packetExport.scrollIntoViewIfNeeded();
    await expect(packetExport.getByText("8 section manifest")).toBeVisible();
    await expect(packetExport.getByText("Supporting documents", { exact: true })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "statement builder workspace");
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

async function navigateToReports(page: Page) {
  const primaryNavigation = getPrimaryNavigation(page);
  const reportsButton = primaryNavigation.getByRole("button", {
    exact: true,
    name: "Reports"
  });

  if (await reportsButton.isVisible().catch(() => false)) {
    await reportsButton.click();
    return;
  }

  await primaryNavigation.getByRole("button", { exact: true, name: "More" }).click();
  await page.getByRole("button", { name: /^Reports/ }).click();
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
