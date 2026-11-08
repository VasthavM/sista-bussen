**Acceptance criteria for the first slice (Totto, 2026-11-08): Capacitor scaffold + update-lane spike.** No Apple account needed; simulator only.

Roadmap blind spot to settle first: the roadmap assumes JS/asset updates keep flowing through the service worker inside the wrapper. A bundled Capacitor app serves from `capacitor://localhost`, and WKWebView service worker support outside App-Bound Domains is doubtful. Verify, don't assume.

- [ ] Capacitor 8.x pinned (not 9), `capacitor.config.ts` with app id `com.vasthavm.sistabussen` (placeholder, Max confirms before submission), `ios/` project generated and committed.
- [ ] `npm run build && npx cap sync ios` works, and the game boots and plays a run in the iOS Simulator. Screenshot committed to `screenshots/`.
- [ ] Written finding in `specs/tickets/8-app-store/spike.md`: does the service worker register inside the wrapper? If not, which update lane is realistic (store-only, a live-update service such as Capgo, or remote `server.url`), with the App Review risk of each (guidelines 2.5.2 and 4.2). Sources linked.
- [ ] Haptics on hit/level-up via `@capacitor/haptics` behind a small adapter, no-op on web.
- [ ] The web build is unaffected: `npm run build`, `npm test` and `npx playwright test` are green and `dist/` behaves as before.

Out of scope: signing, App Store Connect, AdMob, privacy manifest (next slices).
