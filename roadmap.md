# Requested work

- [ ] Search the full catalogue with paginated results, including admin and AI searches.
- [ ] Tie prescription requests to a private anonymous browser capability; do not collect or share IP addresses.
- [ ] Add per-request Telegram operator claim, add, preview, remove, undo and send controls.
- [ ] Deliver operator selections only to the requesting browser, with sound, seven-second notice and automatic cart opening.
- [ ] Separate operator and customer cart items, preserve reload state and test the rules.

- [x] Shorten opening/loading hold and retain the branded fade.
- [x] Persist language and appearance safely across reloads; browser and unit tests passed.
- [x] Prepare independent PostgreSQL backend and connected TanStack self-hosted site without Lovable credentials.
- [x] Preserve existing Telegram handler behavior and document migration; live bot settings untouched.
- [x] Verify authenticated admin save/readback, image upload/rendering, public catalogue and private-data denial; build and type checks passed.
- [ ] Live data cutover, real Telegram/OTP/AI and Docker Compose deployment: require the user's running computer/server and external services; instructions supplied.