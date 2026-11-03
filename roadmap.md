# Requested work

- [ ] Remove three admin menus and pictured footer social rows; add Maps Coordinate beside branches with persisted Yandex coordinates and route orders only to configured branches.

- [x] Add controlled published-app offline support, cached medicines-only view, and best-effort refresh/gesture prevention; live browser disconnect check passed. Published cold-start check awaits a user-requested release.
- [x] Enlarge the support phone action and show full Instagram/Telegram names; use the uploaded medicine image for offline entries; desktop/mobile inspected.
- [x] Verify Telegram operator callbacks with disposable rows and mocked outbound Telegram, and confirm live webhook callbacks enabled, zero pending/error, unauthorized webhook denied; existing bot configuration unchanged.
- [x] Keep the downloadable ZIP unchanged until explicitly requested.

- [x] Search the full catalogue with bounded result pages for public/admin searches and full-name-first AI matching; no capacity advertising.
- [x] Tie prescription requests to a private anonymous browser capability; do not collect or share IP addresses.
- [x] Add per-request Telegram operator claim, add, preview, remove, undo and send controls.
- [x] Deliver operator selections only to the requesting browser, with sound, seven-second notice and automatic cart opening; real upload and database delivery verified.
- [x] Separate operator and customer cart items, preserve reload state and test the rules.
- [ ] Manual Telegram button-to-browser check: requires the user's operator to press real buttons in Telegram; database-backed callback sequence and delivery rules passed, live webhook healthy. Browser sound depends on autoplay permission.

- [x] Shorten opening/loading hold and retain the branded fade.
- [x] Persist language and appearance safely across reloads; browser and unit tests passed.
- [x] Prepare independent PostgreSQL backend and connected TanStack self-hosted site without Lovable credentials.
- [x] Preserve existing Telegram handler behavior and document migration; live bot settings untouched.
- [x] Verify authenticated admin save/readback, image upload/rendering, public catalogue and private-data denial; build and type checks passed.
- [ ] Live data cutover, real Telegram/OTP/AI and Docker Compose deployment: require the user's running computer/server and external services; instructions supplied.