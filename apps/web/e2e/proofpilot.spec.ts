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

    await expect(
      page.getByRole("heading", { name: "ProofPilot Account Appeal Builder" })
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "ProofPilot case workspace preview" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "public landing");
    await expectAccessible(page, "public landing");

    await page.getByRole("button", { exact: true, name: "Sign in" }).first().click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    const signInTab = page.getByRole("tab", { name: "Sign in" });
    const createAccountTab = page.getByRole("tab", { name: "Create account" });
    await expect(signInTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Sign in" })).toBeVisible();

    await signInTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(createAccountTab).toBeFocused();
    await expect(createAccountTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Confirm password", { exact: true })).toBeVisible();

    await page.keyboard.press("Home");
    await expect(signInTab).toBeFocused();
    await expect(signInTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(createAccountTab).toBeFocused();
    await expect(createAccountTab).toHaveAttribute("aria-selected", "true");

    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "public authentication");
    await expectReducedMotion(page);
    await expectAccessible(page, "public authentication");
  });

  test("password recovery is responsive and does not reveal account existence", async ({
    page
  }) => {
    await waitForApi(page);
    await page.goto("/");
    await page.getByRole("button", { exact: true, name: "Sign in" }).first().click();
    await page.getByRole("button", { name: "Forgot password?" }).click();

    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel("Email address").fill(`unknown-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByText(
        "If an account exists for that email, a password reset link has been sent."
      )
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "password recovery request");
    await expectAccessible(page, "password recovery request");

    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await page.goto(`/?resetToken=${"A".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm new password", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "password reset form");
  });

  test("collaboration invitation is responsive and preserves invited identity through sign in", async ({
    page
  }) => {
    const invitationToken = "I".repeat(43);
    await page.route(
      `**/api/public/collaboration/invitations/${invitationToken}`,
      async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            caseTitle: "PayPal account appeal",
            expiresAt: "2099-07-28T16:00:00.000Z",
            invitedEmail: "advisor@proofpilot.test",
            ownerName: "Nicholas Kerr",
            role: "EDITOR",
            status: "PENDING"
          }),
          contentType: "application/json",
          status: 200
        });
      }
    );

    await page.goto(`/?inviteToken=${invitationToken}`);
    await expect(
      page.getByRole("heading", { exact: true, name: "Join PayPal account appeal" })
    ).toBeVisible();
    await expect(page.getByText("Secure case invitation", { exact: true })).toBeVisible();
    await expect(page.getByText("advisor@proofpilot.test", { exact: true })).toBeVisible();
    await expect(page.getByText("Edit case", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "collaboration invitation");
    await expectAccessible(page, "collaboration invitation");

    await page.getByRole("button", { exact: true, name: "Sign in to review" }).click();
    await expect(page.getByRole("heading", { exact: true, name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveValue("advisor@proofpilot.test");
    await page.getByRole("button", { exact: true, name: "Back to invitation" }).click();
    await expect(
      page.getByRole("heading", { exact: true, name: "Join PayPal account appeal" })
    ).toBeVisible();
  });

  test("shared packet access verifies a recipient with a one-time code", async ({
    page
  }) => {
    const shareToken = "S".repeat(43);
    await page.route("**/api/public/packet-shares/metadata", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          expiresAt: "2099-07-28T16:00:00.000Z",
          requireEmailVerification: true
        }),
        contentType: "application/json",
        status: 200
      });
    });
    await page.route("**/api/public/packet-shares/access/request", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          challengeId: "challenge-12345678",
          deliveryMode: "DEVELOPMENT_LOG",
          developmentCode: "482901",
          expiresAt: "2099-07-28T15:10:00.000Z",
          status: "CODE_REQUIRED"
        }),
        contentType: "application/json",
        status: 200
      });
    });
    await page.route("**/api/public/packet-shares/access/verify", async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        challengeId: "challenge-12345678",
        code: "482901",
        email: "advisor@example.com",
        token: shareToken
      });
      await route.fulfill({
        body: JSON.stringify({
          accessToken: "recipient-access-token",
          expiresAt: "2099-07-28T16:00:00.000Z",
          permission: "COMMENT"
        }),
        contentType: "application/json",
        status: 200
      });
    });
    await page.route("**/api/public/packet-shares/content", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          comments: [],
          downloadUrl: null,
          packet: {
            byteSize: 2048,
            createdAt: "2026-07-22T12:00:00.000Z",
            title: "PayPal account closure appeal"
          },
          permission: "COMMENT",
          viewUrl: "https://storage.proofpilot.test/packet.pdf"
        }),
        contentType: "application/json",
        status: 200
      });
    });

    await page.goto(`/shared-packet#${shareToken}`);
    await expect(
      page.getByRole("heading", { name: "A case packet was shared with you" })
    ).toBeVisible();
    await page.getByLabel("Email address").fill("advisor@example.com");
    await page.getByRole("button", { name: "Open shared packet" }).click();

    await expect(
      page.getByRole("heading", { name: "Enter verification code" })
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Verification code" })
    ).toHaveValue("482901");
    await page.getByRole("button", { name: "Verify and open" }).click();

    await expect(
      page.getByRole("heading", { name: "PayPal account closure appeal" })
    ).toBeVisible();
    await expect(page.getByText("Access confirmed", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "shared packet verification");
    await expectAccessible(page, "shared packet verification");
  });

  test("demo user can navigate the signed-in shell", async ({ page }) => {
    await loginAsDemoUser(page);

    const primaryNavigation = getPrimaryNavigation(page);
    const homeButton = primaryNavigation.getByRole("button", { exact: true, name: "Home" });
    await expect(homeButton).toHaveAttribute("aria-current", "page");
    await expectNavigationTargets(primaryNavigation);
    await expectTouchTargets(page, "signed-in home workspace");
    await expect(page.getByText("Processed", { exact: true }).first()).toBeVisible();

    await page.evaluate(() => {
      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }

      window.scrollTo(0, 0);
    });
    const skipLink = page.getByRole("link", { name: "Skip to workspace" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#proofpilot-content")).toBeFocused();

    const invalidResourceResponse = await page.request.get("/api/cases/case.id");
    expect(invalidResourceResponse.status()).toBe(400);
    await expect(invalidResourceResponse.json()).resolves.toMatchObject({
      message: expect.stringContaining("Resource id must be")
    });

    const accountMenuTrigger = page.getByRole("button", { name: "Open account menu" });
    await accountMenuTrigger.click();
    const accountDetails = page.getByRole("region", { name: "Account details" });
    await expect(accountDetails).toContainText("Nicholas Kerr");
    await expect(accountDetails).toContainText(demoCredentials.email);
    await page.keyboard.press("Escape");
    await expect(accountDetails).toBeHidden();
    await expect(accountMenuTrigger).toBeFocused();

    await accountMenuTrigger.click();
    await accountDetails.getByRole("button", { name: "Manage account" }).click();
    await expect(page.getByRole("heading", { exact: true, name: "Account" })).toBeVisible();
    const profileTab = page.getByRole("tab", { exact: true, name: "Profile" });
    const securityTab = page.getByRole("tab", { exact: true, name: "Security" });
    await profileTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(securityTab).toBeFocused();
    await expect(securityTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(profileTab).toBeFocused();
    await expect(profileTab).toHaveAttribute("aria-selected", "true");

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

    await primaryNavigation.getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("button", { name: /^Settings / }).click();
    await expect(page.getByRole("heading", { exact: true, name: "Settings" })).toBeVisible();
    await expectTouchTargets(page, "settings workspace");
    await expectAccessible(page, "settings workspace");

    await page.keyboard.press("Control+K");
    await expect(page.getByRole("heading", { exact: true, name: "Search" })).toBeVisible();
    const allResultsTab = page.getByRole("tab", { name: /^All results/ });
    const firstResultTypeTab = page.getByRole("tab").nth(1);
    await expect(firstResultTypeTab).toBeVisible();
    await allResultsTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(firstResultTypeTab).toBeFocused();
    await expect(firstResultTypeTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(allResultsTab).toBeFocused();
    await page.getByRole("searchbox", { name: "Search workspace" }).fill("PayPal");
    await expectTouchTargets(page, "search workspace");
    await expectAccessible(page, "search workspace");

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

    await primaryNavigation.getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("button", { name: /^Security & privacy/ }).click();
    await expect(
      page.getByRole("heading", { exact: true, name: "Security & Privacy" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Active sessions" })
    ).toBeVisible();
    await expect(page.getByText("Current", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "security and active sessions workspace");
  });

  test("demo user can create, complete, edit, and delete a case task", async ({
    page
  }) => {
    await loginAsDemoUser(page);
    await navigateToTasks(page);

    await expect(page.getByRole("heading", { exact: true, name: "Tasks" })).toBeVisible();
    await expect(getVisibleTaskRow(page, "Upload proof of identity")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "tasks workspace");
    await expectAccessible(page, "tasks workspace");

    const taskTitle = `Task verification ${Date.now()}`;
    const updatedTitle = `${taskTitle} updated`;
    await page.getByRole("button", { exact: true, name: "Add task" }).click();

    const taskEditor = page.getByRole("region", { name: "Add a case task" });
    await taskEditor.getByLabel("Task", { exact: true }).fill(taskTitle);
    await taskEditor
      .getByLabel("Description", { exact: true })
      .fill("Created by the responsive task workflow test.");
    await taskEditor.getByLabel("Priority", { exact: true }).selectOption("HIGH");
    await taskEditor.getByLabel("Due date", { exact: true }).fill("2099-07-30");
    await taskEditor.getByRole("button", { exact: true, name: "Add task" }).click();

    await expect(page.getByText("Task added.", { exact: true })).toBeVisible();
    let taskRow = getVisibleTaskRow(page, taskTitle);
    await expect(taskRow).toBeVisible();
    await taskRow.getByRole("checkbox", { name: `Complete ${taskTitle}` }).click();
    await expect(page.getByText("Task completed.", { exact: true })).toBeVisible();
    await expect(
      taskRow.getByRole("checkbox", { name: `Reopen ${taskTitle}` })
    ).toBeChecked();

    await taskRow.getByRole("button", { name: `Edit ${taskTitle}` }).click();
    const editTaskEditor = page.getByRole("region", { name: "Edit task" });
    await editTaskEditor.getByLabel("Task", { exact: true }).fill(updatedTitle);
    await editTaskEditor
      .getByRole("button", { exact: true, name: "Save task" })
      .click();

    await expect(page.getByText("Task updated.", { exact: true })).toBeVisible();
    taskRow = getVisibleTaskRow(page, updatedTitle);
    await expect(taskRow).toBeVisible();
    await taskRow.getByRole("button", { name: `Edit ${updatedTitle}` }).click();
    await page
      .getByRole("region", { name: "Edit task" })
      .getByRole("button", { exact: true, name: "Delete" })
      .click();
    await page
      .getByRole("region", { name: "Edit task" })
      .getByRole("button", { exact: true, name: "Delete" })
      .click();

    await expect(page.getByText("Task deleted.", { exact: true })).toBeVisible();
    await expect(getVisibleTaskRow(page, updatedTitle)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("demo user can review inbox conversations separately from notifications", async ({
    page
  }) => {
    await loginAsDemoUser(page);
    await navigateToInbox(page);

    await expect(page.getByRole("heading", { exact: true, name: "Inbox" })).toBeVisible();
    const supportConversation = page.getByRole("button", {
      name: "Open ProofPilot Support: PayPal account closure appeal"
    });
    await expect(supportConversation).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "inbox conversation list");
    await expectAccessible(page, "inbox conversation list");

    await supportConversation.click();
    const supportConversationDetail = page.getByRole("region", {
      name: "PayPal account closure appeal"
    });
    await expect(
      supportConversationDetail.getByRole("heading", {
        exact: true,
        name: "PayPal account closure appeal"
      })
    ).toBeVisible();
    await expect(
      supportConversationDetail.getByText("ProofPilot Support", { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByLabel("Reply message")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "inbox conversation detail");
    await expectAccessible(page, "inbox conversation detail");

    const markUnreadButton = page.getByRole("button", {
      name: "Mark conversation unread"
    });
    await expect(markUnreadButton).toBeEnabled();
    await markUnreadButton.click();
    await expect(page.getByText("Conversation marked unread.", { exact: true })).toBeVisible();

    const backButton = page.getByRole("button", { name: "Back to conversations" });
    if (await backButton.isVisible().catch(() => false)) {
      await backButton.click();
    }
    await page
      .getByRole("button", {
        name: "Open ProofPilot Support: PayPal account closure appeal"
      })
      .click();

    await navigateToNotifications(page);
    await expect(
      page.getByRole("heading", { exact: true, name: "Notifications" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("demo user can capture and review a document scan", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("No camera available in this test.", "NotFoundError");
          }
        }
      });
    });
    await loginAsDemoUser(page);

    await getPrimaryNavigation(page)
      .getByRole("button", { name: /^Upload/ })
      .click();
    await expect(page.getByRole("heading", { exact: true, name: "Import evidence" })).toBeVisible();

    await page
      .getByRole("button", { name: /^(Camera scan|Scan document)/ })
      .click();
    const cameraHeading = page.getByRole("heading", { exact: true, name: "Scan document" });
    await expect(cameraHeading).toBeVisible();
    await expect(cameraHeading).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByText("Live camera unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Capture document" })).toBeDisabled();

    await page.getByLabel("Choose scan image").setInputFiles({
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
        "base64"
      ),
      mimeType: "image/png",
      name: "account-notice.png"
    });

    const scanReviewHeading = page.getByRole("heading", { exact: true, name: "Scan review" });
    await expect(scanReviewHeading).toBeVisible();
    await expect(scanReviewHeading).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByAltText("Scan preview of account-notice.png")).toBeVisible();
    await page.getByRole("button", { name: "Rotate scan right" }).click();
    await page.getByRole("button", { exact: true, name: "Crop" }).click();
    await page.getByRole("button", { exact: true, name: "10%" }).click();
    await expect(page.getByText("90 degree rotation, 10% center crop", { exact: true })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "scan review");
    await expectAccessible(page, "scan review");

    await page.getByRole("button", { exact: true, name: "Retake" }).click();
    await expect(cameraHeading).toBeVisible();
    await expect(cameraHeading).toBeFocused();
    await page.getByRole("button", { name: "Back to evidence sources" }).click();
    const sourceHeading = page.getByRole("heading", { exact: true, name: "Choose a source" });
    await expect(sourceHeading).toBeVisible();
    await expect(sourceHeading).toBeFocused();
  });

  test("demo user can browse connected Gmail and Google Drive evidence", async ({
    page
  }) => {
    await loginAsDemoUser(page);
    await getPrimaryNavigation(page)
      .getByRole("button", { name: /^Upload/ })
      .click();
    await expect(page.getByRole("heading", { exact: true, name: "Import evidence" })).toBeVisible();

    await page.getByRole("button", { name: /^Gmail/ }).click();
    const gmailHeading = page.getByRole("heading", { exact: true, name: "Gmail import" });
    await expect(gmailHeading).toBeVisible();
    await expect(gmailHeading).toBeFocused();
    await expect(page.getByText("Connected Gmail account", { exact: true })).toBeVisible();
    const emailList = page.getByRole("region", { name: "Select emails to import" });
    await expect(emailList.locator('input[type="checkbox"]:checked')).toHaveCount(4);

    const allEmailsTab = page.getByRole("tab", { name: /^All emails/ });
    const selectedEmailsTab = page.getByRole("tab", { name: /^Selected/ });
    await allEmailsTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(selectedEmailsTab).toBeFocused();
    await expect(selectedEmailsTab).toHaveAttribute("aria-selected", "true");
    await expect(emailList.getByRole("listitem")).toHaveCount(4);
    await allEmailsTab.click();
    await emailList.getByLabel("Select Limitation notice from PayPal").uncheck();
    await expect(page.getByRole("button", { name: "Import 3", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "Gmail import workspace");

    await page.getByRole("button", { name: "Back to evidence sources" }).click();
    await expect(page.getByRole("heading", { exact: true, name: "Choose a source" })).toBeVisible();
    await page.getByRole("button", { name: /^Google Drive/ }).click();
    await expect(
      page.getByRole("heading", { exact: true, name: "Google Drive import" })
    ).toBeVisible();
    await expect(page.getByText("bank-statement.pdf", { exact: true })).toBeVisible();

    const driveSearch = page.getByLabel("Search Google Drive files");
    await driveSearch.fill("communication");
    await expect(page.getByText("communication-log.pdf", { exact: true })).toBeVisible();
    await expect(page.getByText("bank-statement.pdf", { exact: true })).toHaveCount(0);
    await driveSearch.fill("");
    await page.getByLabel("Filter by file type").selectOption("PDF");
    await expect(page.getByText("bank-statement.pdf", { exact: true })).toBeVisible();
    await expect(page.getByText("appeal-draft.docx", { exact: true })).toHaveCount(0);
    await page.getByLabel("Filter by file type").selectOption("ALL");
    await page.getByLabel("Sort Google Drive files").selectOption("NAME");
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "Google Drive import workspace");
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
    await expectTouchTargets(page, "case workspace");

    const caseSections = page.getByRole("navigation", {
      name: "Case workspace sections"
    });
    await caseSections.getByRole("button", { exact: true, name: "Timeline" }).click();
    await expect(page).toHaveURL(/\/timeline$/);
    await caseSections.getByRole("button", { exact: true, name: "Overview" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/timeline$/);

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

    await page
      .getByRole("navigation", { name: "Case workspace sections" })
      .getByRole("button", { exact: true, name: "Checklist" })
      .click();
    await expect(page).toHaveURL(/\/checklist$/);

    const checklist = page.locator("#evidence-checklist");
    await checklist.scrollIntoViewIfNeeded();
    const ownershipProof = checklist.getByRole("button", {
      name: /Account ownership proof/
    });
    if ((await ownershipProof.getAttribute("aria-expanded")) !== "true") {
      await ownershipProof.click();
    }

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

  test("demo user can inspect claim evidence and the prior appeal outcome", async ({
    page
  }) => {
    await loginAsDemoUser(page);

    await getPrimaryNavigation(page)
      .getByRole("button", { exact: true, name: "Cases" })
      .click();
    await page
      .getByRole("button", { name: /PayPal account closure appeal/ })
      .first()
      .click();

    const caseSections = page.getByRole("navigation", {
      name: "Case workspace sections"
    });
    await caseSections.getByRole("button", { exact: true, name: "Proof Map" }).click();
    await expect(page).toHaveURL(/\/proof$/);
    await expect(
      page.getByRole("heading", { exact: true, name: "Proof Map" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Appeal claims" })
    ).toBeVisible();

    await page
      .getByRole("button", { name: /The account action is documented/ })
      .click();
    const limitationSource = page
      .getByRole("button", {
        name: /limitation-notice\.eml evidence/
      })
      .first();
    await expect(limitationSource).toBeVisible();
    await expect(limitationSource).toContainText(
      "PayPal has placed a permanent limitation"
    );
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "Proof Map workspace");

    await caseSections
      .getByRole("button", { exact: true, name: "Submission" })
      .click();
    await expect(page).toHaveURL(/\/submission$/);
    await expect(
      page.getByRole("heading", { exact: true, name: "Submission" })
    ).toBeVisible();
    const submissionOverview = page.locator(
      "#submission-tracker .proof-accent-frame"
    );
    await expect(
      submissionOverview.getByText("Appeal round 1", { exact: true })
    ).toBeVisible();
    await expect(
      submissionOverview.getByRole("heading", { exact: true, name: "Denied" })
    ).toBeVisible();
    await expect(
      submissionOverview.getByText("PP-2026-0147", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Initial appeal denied", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "submission tracker workspace");
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

    const caseSections = page.getByRole("navigation", {
      name: "Case workspace sections"
    });
    await caseSections.getByRole("button", { exact: true, name: "Statement" }).click();
    await expect(page).toHaveURL(/\/statement$/);

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

    await caseSections.getByRole("button", { exact: true, name: "Packet" }).click();
    await expect(page).toHaveURL(/\/packet$/);
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
  await expect(
    page.getByRole("heading", { name: "ProofPilot Account Appeal Builder" })
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Sign in" }).first().click();
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

async function navigateToTasks(page: Page) {
  const primaryNavigation = getPrimaryNavigation(page);
  const tasksButton = primaryNavigation.getByRole("button", {
    exact: true,
    name: "Tasks"
  });

  if (await tasksButton.isVisible().catch(() => false)) {
    await tasksButton.click();
    return;
  }

  await primaryNavigation.getByRole("button", { exact: true, name: "More" }).click();
  await page.getByRole("button", { name: /^Tasks/ }).click();
}

async function navigateToInbox(page: Page) {
  await getPrimaryNavigation(page)
    .getByRole("button", { exact: true, name: "Inbox" })
    .click();
}

async function navigateToNotifications(page: Page) {
  const notificationButton = page.getByRole("button", { name: /^Open notifications/ });

  if (await notificationButton.isVisible().catch(() => false)) {
    await notificationButton.click();
    return;
  }

  await getPrimaryNavigation(page)
    .getByRole("button", { exact: true, name: "More" })
    .click();
  await page.getByRole("button", { name: /^Notifications/ }).click();
}

function getVisibleTaskRow(page: Page, title: string) {
  return page.locator("article:visible").filter({ hasText: title });
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

async function expectTouchTargets(page: Page, surface: string) {
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    return;
  }

  const undersizedTargets = await page
    .locator(
      'button, a[href], input:not([type="file"]):not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="switch"]'
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const style = window.getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        const isVisible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          bounds.width > 1 &&
          bounds.height > 1;

        if (!isVisible || (bounds.width >= 44 && bounds.height >= 44)) {
          return [];
        }

        return [
          {
            height: Math.round(bounds.height * 10) / 10,
            label:
              element.getAttribute("aria-label") ??
              element.getAttribute("title") ??
              element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ??
              element.tagName.toLowerCase(),
            width: Math.round(bounds.width * 10) / 10
          }
        ];
      })
    );

  expect(
    undersizedTargets,
    `${surface} contains interactive targets smaller than 44px.`
  ).toEqual([]);
}

async function expectReducedMotion(page: Page) {
  const reducedMotionStyles = await page.evaluate(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return null;
    }

    const target = document.querySelector("button");
    const transitionDuration = target
      ? maximumDurationInMilliseconds(window.getComputedStyle(target).transitionDuration)
      : 0;

    return {
      scrollBehavior: window.getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration
    };

    function maximumDurationInMilliseconds(value: string) {
      return Math.max(
        ...value.split(",").map((duration) => {
          const normalizedDuration = duration.trim();
          const numericDuration = Number.parseFloat(normalizedDuration);

          return normalizedDuration.endsWith("ms") ? numericDuration : numericDuration * 1_000;
        })
      );
    }
  });

  if (!reducedMotionStyles) {
    return;
  }

  expect(reducedMotionStyles.scrollBehavior).toBe("auto");
  expect(reducedMotionStyles.transitionDuration).toBeLessThanOrEqual(0.001);
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

  await expectNoVisibleScrollbars(page);
}

async function expectNoVisibleScrollbars(page: Page) {
  const visibleScrollbarSurfaces = await page.locator("*").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const style = window.getComputedStyle(element);
      const isDocumentScroller = element === document.documentElement;
      const hasScrollableOverflow =
        element.scrollHeight > element.clientHeight + 1 ||
        element.scrollWidth > element.clientWidth + 1;
      const permitsScrolling = [style.overflow, style.overflowX, style.overflowY].some(
        (value) => value === "auto" || value === "scroll"
      );

      if (
        (!isDocumentScroller && (!hasScrollableOverflow || !permitsScrolling)) ||
        style.scrollbarWidth === "none"
      ) {
        return [];
      }

      return [
        {
          className: element.className.toString().slice(0, 120),
          tagName: element.tagName.toLowerCase()
        }
      ];
    })
  );

  expect(
    visibleScrollbarSurfaces,
    "Scrollable surfaces must remain functional without visible scrollbars."
  ).toEqual([]);
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
