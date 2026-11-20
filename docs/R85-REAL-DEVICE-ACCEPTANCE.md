# R85 V3 — Real-device acceptance gate (not a deployment approval)

**Build under review:** PR #17, branch `integration/r85-v3-on-live-r82-20261120`.
**Production:** Keep R82 untouched until a separate approval. Do not test R85 against existing player accounts or the production SQLite database.

## Where to test

Use an **isolated, access-controlled staging URL** that runs the exact PR-head commit, with a **new disposable database**. Do not point the staging server at `/data/hmong.db` or copy player credentials into it. If no isolated staging URL exists, these tests are **BLOCKED**, not PASS. Do not interpret emulator CI as real-device coverage.

Before opening the URL on phones, run the read-only `node tools/r85-release-check.js https://YOUR-STAGING-HOST` and record the response from `/api/build-info`, including `revision` when available. Confirm the commit matches the PR head. Never use the production URL for this verification.

## Test on physical Android and iPhone

Complete every scenario **separately** on (1) Android Chrome and (2) iPhone Safari, first over Wi-Fi and then over mobile data if accessible.

| ID | Action | PASS evidence |
|---|---|---|
| R85-01 | Open staging URL in a fresh private tab, without a saved session | Splash completes, “แตะเพื่อเข้าเกม” stays tappable |
| R85-02 | Tap enter, register/login using a disposable staging account | Login form appears, login succeeds, no blank screen |
| R85-03 | Drag anywhere in the **left 50%** with one finger | Character moves predictably; joystick releases cleanly |
| R85-04 | Tap an accessible walkable spot | Small destination ring appears, no guide line; character moves |
| R85-05 | Hold joystick with left thumb and press **each** of six real skill slots with right thumb | Right thumb does not cancel movement; skills honor lock/cooldown |
| R85-06 | Hold joystick and attack; release attack, keep joystick held | Attack stops, movement continues |
| R85-07 | Open/close menus and use Target, Dash, AUTO | Buttons respond; no accidentally held joystick or attacks |
| R85-08 | Use a second disposable staging account on another phone in the same zone | Both players see each other, move independently and remain connected |
| R85-09 | Switch between Wi-Fi and mobile data, reload, and resume | No permanently stuck loading/login state; note any reconnection errors |
| R85-10 | Rotate phone, hide browser and return, repeat quick taps | Controls remain within screen and no stale held input persists |

## Evidence to capture

For each phone, record: device model, OS/browser version, network (Wi-Fi/mobile operator), tested URL, commit from build-info, date/time, result for R85-01…10 (PASS/FAIL/BLOCKED), and a screenshot/video or relevant console/network log for every failure.

**Release gate:** both devices pass all applicable checks, two-account real-device test passes, staging fingerprint matches the PR head, production database backup/restore is separately verified, and owner explicitly authorizes deployment. Until then leave PR #17 as draft and do not merge or deploy.
