Done 2026-11-08.

- Max added `A sista-bussen` → `187.124.132.205` at one.com.
- Coolify domains for the app are `https://sista-bussen.vasthavm.com,https://q1khvfvk2w9tho9rc5psbhxx.187.124.132.205.sslip.io`. The sslip host is kept on purpose: existing installs are bound to that origin, and their saves live in its localStorage.
- Redeployed 22:06 (main @ `b1747f1`).
- Live smoke check (`tools/live-check.mjs`) passes on both hosts:
  - Let's Encrypt certificate, with the new host's CN/SAN = `sista-bussen.vasthavm.com`, valid to 2027-02-06.
  - Manifest served as `application/manifest+json`.
  - Service worker active.
  - Zero console errors and zero failed requests.

Follow-up: README still names the sslip host as the main URL. That gets fixed with the phase 1 docs pass.
