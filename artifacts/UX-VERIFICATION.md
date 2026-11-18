# Compact layout verification

Verified against the production build at normal browser zoom.

- At 1280 × 640, the landing page height is exactly 640px, including the footer.
- At 1280 × 640, all four market rows fit above the viewport bottom (last row ends at 575px).
- Desktop market navigation defaults to a 64px icon rail and expands to 216px with labels.
- All market columns fit without horizontal scrolling at 1024px and 1280px with the default rail, and at 1280px with the expanded sidebar.
- At 390px, the sidebar becomes a drawer. Escape closes it and restores focus to the toggle. Tab wraps within the drawer.
- Sidebar category selection works with Enter in the compact rail and closes the drawer on mobile.
- Market search, empty-result reset, category selection, and ascending/descending price sorting work.
- Documentation search, section anchors, code copying, and compact-rail shortcuts work.
- The market table is a labeled, keyboard-focusable scroll region on narrow screens.
- Landing and documentation have no page-level horizontal overflow at 320px.
- The hero retains its floating loop and reduced-motion stylesheet support.
- No console errors occurred in the production checks.

Validation passed: `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check`.

Current laptop captures: `landing-laptop.png`, `markets-laptop.png`, `markets-expanded-laptop.png`, and `docs-laptop.png`. Mobile drawer capture: `markets-drawer-mobile.png`.
