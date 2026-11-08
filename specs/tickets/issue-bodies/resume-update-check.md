Follow-up to #6. Updates are detected only on cold start. iOS keeps an installed PWA alive in memory for days, so a pushed update can sit unseen.

## Acceptance criteria
- [ ] When the app returns to the foreground (`visibilitychange` → visible), it asks the service worker registration to check for an update (`registration.update()`), throttled to at most once per 30 minutes (constant, not inline).
- [ ] Never during a run's active play. A check that finds an update follows the existing #6 rules: banner, apply only at the menu.
- [ ] No-op when `navigator.serviceWorker` is absent (Capacitor iOS).
- [ ] An e2e test: background → foreground after a new worker is published raises `Ny version klar`, and a second foreground inside the throttle window doesn't call `update()` again.
- [ ] The #6 update spec passes under Playwright's WebKit project as well as Chromium.

Do not touch `src/sim/`.
