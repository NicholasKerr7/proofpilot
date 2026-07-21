# Accessibility And Responsive Verification

ProofPilot is mobile-first, with tablet and desktop layouts layered on top of the same workflow.

## Current Pass

- App shell has a skip link to `#proofpilot-content`.
- Authenticated workspace uses one primary `<main>` landmark.
- Desktop and mobile navigation have explicit labels and current-page state.
- Dashboard filter buttons expose pressed state.
- Authentication, account, and search tablists use roving focus with Arrow, Home, and End key support.
- Escape closes the account disclosure and restores focus to its trigger.
- Auth and upload errors use alert/status semantics.
- Decorative Lucide icons are hidden from assistive technology where nearby text already names the control.
- Interactive controls use at least a 44 px touch target on mobile and tablet, including compact switches and filters.
- Playwright and axe-core cover public authentication and the signed-in demo shell at mobile, tablet, and desktop widths.

## Automated Checks

With PostgreSQL and Redis running, the demo database seeded, and `pnpm dev` active, run:

```bash
pnpm --filter @proofpilot/web exec playwright install chromium
pnpm test:e2e
```

The browser install is needed once per Playwright version. The runner checks WCAG A/AA rules, horizontal overflow, 44 px touch targets, skip-link focus, tablist keyboard navigation, disclosure focus restoration, reduced-motion styles, account identity, and core workspace navigation at `390 x 844`, `768 x 1024`, and `1280 x 900`. CI provisions and starts its own isolated web/API stack.

## Manual Viewports

Verify these viewports before release:

- `375 x 812`: mobile capture and bottom navigation.
- `768 x 1024`: tablet review layout, compared against [tablet-reference.md](design/tablet-reference.md).
- `1280 x 900`: desktop command-center layout.
- `1440 x 1100`: wide desktop density and line lengths.

Checks:

- No text overlaps or truncates critical actions.
- Bottom navigation does not cover primary actions or upload progress.
- Touch targets remain at least 44 px in each dimension.
- Focus order reaches skip link, navigation, filters, upload, case actions, and packet generation.
- Reduced-motion mode keeps the app usable without smooth scroll or transition dependency.
