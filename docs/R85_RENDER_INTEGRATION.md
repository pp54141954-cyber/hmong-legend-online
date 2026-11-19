# R85 V3 Calm — Render integration safety gate

**Status:** Code integrated in `feature/joystick-safety-r85b-20261116`, not verified on live Render.
**Production URL used by owner:** `https://hmong-legend-2.onrender.com` (deployment source not yet verified).

## Included
- Floating joystick on whole left half, pointer ownership and release on blur/cancel.
- 6 real class skill buttons with cooldown/hold input; attack, Dash, AUTO and target select.
- Small gold destination ring without route line, uses original collision/pathfinding.
- Approved R85 V3 Calm presentation and local-only bug report panel.
- Server serves `/r85-calm-controls.css` and read-only `/api/build-info`.
- **Docker image fix:** copies `game/r85-calm-controls.css` next to `game/index.html`.

## Mandatory checks before changing production

1. Confirm the **exact Render service, repository, branch, start command, Docker image and persistent disk/DB path** from the Render dashboard. Do **not** assume the `main` branch is live: this repository's `main` has only a README and the R85 feature branch has the complete game.
2. Back up the **actual online player database** safely and verify that it can be restored. `DB_FILE` and persistent disk mount must be checked before any restart or deploy. Do not change account/character data to test UI.
3. Keep the existing live source/branch and record its commit SHA for rollback. Deploy a staging instance using the full R85 branch with isolated test database first.
4. Run `node tools/r85-release-check.js https://YOUR-STAGING-HOST`. It must report PASS for build fingerprint, HTML controls and CSS. On the host, `GET /api/build-info` must contain `"build":"R85-V3-Calm"`.
5. Run the GitHub Actions workflow `mobile-controls-r85.yml`: Android Chromium, iPhone WebKit, multi-touch, R82/R83 compatibility, and two-player isolated WebSocket tests. **No pass claim without actual CI evidence**.
6. Verify manual Android/iPhone real-device input on the staging instance: joystick x=20.8%, y=65.9%, whole left half touch; each of 6 skill slots with joystick; simultaneous attack; pointer release/cancel; portrait and landscape; collision and tap-to-walk ring.
7. After owner accepts tested staging build, deploy the correct commit to the verified Render service with a backup/rollback plan. Re-run release check against production and verify player data.

## Known blockers as of this integration

- Render source branch/environment/volume details not accessible from connected GitHub alone.
- Actual CI and physical-device results not yet verified.
- Prior production screenshot shows legacy controls and a Level 1 player. That cannot by itself determine whether the causes are stale deployment, locked skills or a mobile touch regression.

**Do not merge the 160+ commits between `main` and the feature branch merely to enable the new controls without a deployment review.**
