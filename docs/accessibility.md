# Accessibility And Responsive Verification

ProofPilot is mobile-first, with tablet and desktop layouts layered on top of the same workflow.

## Current Pass

- App shell has a skip link to `#proofpilot-content`.
- Authenticated workspace uses one primary `<main>` landmark.
- Desktop and mobile navigation have explicit labels and current-page state.
- Dashboard filter buttons expose pressed state.
- Auth and upload errors use alert/status semantics.
- Decorative Lucide icons are hidden from assistive technology where nearby text already names the control.

## Manual Viewports

Verify these viewports before release:

- `375 x 812`: mobile capture and bottom navigation.
- `768 x 1024`: tablet review layout, compared against [tablet-reference.md](design/tablet-reference.md).
- `1280 x 900`: desktop command-center layout.
- `1440 x 1100`: wide desktop density and line lengths.

Checks:

- No text overlaps or truncates critical actions.
- Bottom navigation does not cover primary actions or upload progress.
- Touch targets remain at least 44 px tall.
- Focus order reaches skip link, navigation, filters, upload, case actions, and packet generation.
- Reduced-motion mode keeps the app usable without smooth scroll or transition dependency.
