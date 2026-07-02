# ProofPilot Mobile Design Reference

Imported from `/Users/nick007/Downloads/proofpilot_assets.zip` on July 2, 2026.

## Asset Locations

- App-ready brand assets: `apps/web/public/brand/`
- Mobile reference screenshots: `docs/design/mobile-reference/`
- Mobile screenshot size: `941 x 1672`

Keep the reference screenshots in docs. They are visual references, not public app assets. Use the brand assets in `apps/web/public/brand/` when implementing product UI.

## Brand Assets

- `proofpilot-brand-icon-transparent.webp`
- `proofpilot-golden-starburst-bg.webp`
- `proofpilot-open-passport-display.webp`
- `proofpilot-passport-identity-page.webp`
- `proofpilot-passport-scan-frame.webp`
- `proofpilot-purple-logo.webp`

## Mobile Visual Direction

- Use a dark graphite and black base with restrained copper, champagne, and warm orange accents.
- Preserve the polished mobile app feel: dense operational screens, clear hierarchy, large touch targets, and persistent primary actions.
- Prefer icon-led controls, status chips, segmented controls, tabs, progress indicators, bottom sheets, and fixed bottom navigation.
- Keep onboarding more editorial, but keep authenticated screens task-focused and compact.
- Use green for success/found states, amber or orange for warning and missing states, purple for AI/review states, and blue for document/import states.
- Preserve reduced-motion behavior and avoid decorative effects that make the app feel less utilitarian.

## MVP Screen Priority

Use these screens first while building the Account Ban / Appeal Builder flow:

- `proofpilot-mobile-01-landing-onboarding.webp`: onboarding and brand tone.
- `proofpilot-mobile-02-sign-in.webp`: sign-in layout.
- `proofpilot-mobile-03-create-account.webp`: registration layout.
- `proofpilot-mobile-05-home-dashboard.webp`: authenticated dashboard structure.
- `proofpilot-mobile-06-cases-list.webp`: case list density and status treatment.
- `proofpilot-mobile-07-create-case.webp`: case creation form pattern.
- `proofpilot-mobile-08-case-overview.webp`: case hub and progress summary.
- `proofpilot-mobile-09-evidence-vault.webp`: evidence search, filters, upload CTA, and list items.
- `proofpilot-mobile-10-timeline.webp`: generated timeline layout.
- `proofpilot-mobile-11-missing-evidence-checklist.webp`: checklist grouping and evidence state chips.
- `proofpilot-mobile-12-requirement-detail.webp`: requirement detail and action pattern.
- `proofpilot-mobile-13-statement-builder.webp`: appeal statement editor.
- `proofpilot-mobile-14-statement-versions.webp`: statement versioning.
- `proofpilot-mobile-15-packet-preview.webp`: packet preview.
- `proofpilot-mobile-16-packet-ready.webp`: completion state.
- `proofpilot-mobile-17-packet-detail-export-history.webp`: export history and packet detail.
- `proofpilot-mobile-41-import-evidence.webp`: import entry points.
- `proofpilot-mobile-44-upload-queue.webp`: upload queue.
- `proofpilot-mobile-45-scan-document.webp`: scan capture.
- `proofpilot-mobile-46-scan-review.webp`: scan review.
- `proofpilot-mobile-47-document-detail.webp`: document detail and extracted metadata.

## Later Breakpoints

When tablet and desktop assets are provided, add them under:

- `docs/design/tablet-reference/`
- `docs/design/desktop-reference/`

Mobile remains the source of truth until those references are added.
