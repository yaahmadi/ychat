# YChat App Store Repair and Cross-Platform Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the current YChat App Store rejection repair, verify the production authentication paths, correct review/privacy metadata, and produce synchronized iOS Build 3 plus an updated Android release without making phone OTP a release blocker.

**Architecture:** The hosted Next.js application at `https://ychat.yamaahmadi.com` remains the shared web core for web, iOS, and Android. Authentication continues through Supabase with Apple, Google, and email/password as core methods. Phone verification remains optional/provider-dependent. Native packages are validated only after the production web build is serving the intended commit.

**Tech Stack:** Next.js 16.3, React 19, Supabase Auth, Capacitor 8, Xcode/iOS, Android Gradle, Cloudflare, systemd.

**Spec:** `docs/superpowers/specs/2026-10-15-ychat-multidevice-reliability-design.md`

## Global Constraints

- Production branch is `premium-ui-v2`.
- Canonical app URL is `https://ychat.yamaahmadi.com`.
- iOS bundle id remains `com.yamaahmadi.ychat`.
- Apple, Google, and email/password are core login methods.
- Phone verification is optional and must not block release when no valid SMS transport is configured.
- Do not commit OAuth secrets, Apple `.p8` files, passwords, or provider credentials.
- Do not alter unrelated chat/call/story behavior in this release.

## Review Focus

- Apple OAuth redirect completes back into `/chat` on Safari and in the Capacitor iOS shell.
- Google login remains functional after Apple changes.
- Reviewer email/password credentials create a real session and have access to the main chat UI.
- iPad login layout does not clip the YChat logo or authentication controls.
- Phone OTP failures are clearly optional and do not interfere with Apple/Google/email login.

---

### Task 1: Lock the production login UI and optional-phone behavior

**Files:**
- Modify: `app/auth/login/page.tsx`
- Modify: `app/globals.css`
- Test: targeted source assertions plus `npm run build`

**Interfaces:**
- Consumes: existing Supabase browser client from `@/lib/supabase/client`.
- Produces: login UI with one YChat logo, visible Apple button, Apple/Google/email core auth, and optional phone OTP that never calls verify before an OTP exists.

- [ ] **Step 1: Write failing source assertions**

Create a temporary shell check that asserts: only `/icon-192.png` is used in the login header, `yama-logo.png` is absent from the login header, `provider: "apple"` is present, `.ychat-apple-login` is present, and the phone form does not submit directly to `verifyPhoneOtp` before `otpSent` is true.

- [ ] **Step 2: Run assertions and verify any remaining mismatch fails**

Run the shell assertions from the repository root. Expected: any still-unfixed condition exits non-zero.

- [ ] **Step 3: Make the minimum UI/auth corrections**

Keep the current working Apple/Google/email flow. Keep one centered YChat app logo. Keep phone as optional and preserve the two-stage `signInWithOtp` then `verifyOtp` behavior.

- [ ] **Step 4: Verify targeted lint/build**

Run:

```bash
npx eslint app/auth/login/page.tsx app/privacy/page.tsx
npm run build
```

Expected: targeted lint passes; production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/auth/login/page.tsx app/globals.css app/privacy/page.tsx
git commit -m "Harden YChat review login experience"
```

### Task 2: Verify the App Review demo account

**Files:**
- No source file required unless a product bug is found.
- Supabase Auth data/config only.

**Interfaces:**
- Consumes: reviewer email address supplied in App Store Connect.
- Produces: confirmed working email/password reviewer account with access to `/chat`.

- [ ] **Step 1: Query Supabase Auth for the reviewer account**

Check `auth.users` for the configured review email and confirm the account exists, is confirmed, is not banned, and has a usable auth identity.

- [ ] **Step 2: Test the credentials through the production login UI**

Use the exact App Review credentials in `https://ychat.yamaahmadi.com/auth/login` and confirm a session reaches `/chat`.

- [ ] **Step 3: Repair only through supported Auth controls if needed**

If the password is wrong, reset/create the reviewer account through Supabase Auth administration rather than editing `encrypted_password` directly.

- [ ] **Step 4: Record the validated credentials only in App Store Connect review fields**

Do not commit them to Git or documentation.

### Task 3: Correct App Privacy metadata and review notes

**Files:**
- Verify: `app/privacy/page.tsx`
- External: App Store Connect privacy questionnaire/review notes.

**Interfaces:**
- Consumes: actual app behavior/source audit.
- Produces: App Store metadata that accurately reflects whether Contacts are accessed or used for tracking.

- [ ] **Step 1: Audit source for device-contact access**

Search for Contacts/Address Book APIs and packages (`CNContact`, `navigator.contacts`, Capacitor contacts plugins, address-book SDKs). Expected for this release: no device address-book access.

- [ ] **Step 2: Update App Store privacy declaration**

If the audit confirms no address-book collection, remove Contacts from collected data rather than marking it as tracking. Do not enable ATT solely to satisfy an inaccurate declaration.

- [ ] **Step 3: Verify privacy page language**

Ensure the page mentions Apple/Google/email auth accurately and does not claim unnecessary contact collection.

- [ ] **Step 4: Prepare review notes**

State that Sign in with Apple was added, the privacy declaration was corrected to match actual behavior, the demo account was revalidated, and the app was tested on iPad.

### Task 4: Production deployment and OAuth verification

**Files:**
- No new source files unless a discovered bug requires one.
- Server path: `/home/yama/ychat`.

**Interfaces:**
- Consumes: commit from Task 1.
- Produces: production site serving the validated commit with working Apple/Google/email auth.

- [ ] **Step 1: Push `premium-ui-v2`**

```bash
git push origin premium-ui-v2
```

- [ ] **Step 2: Deploy to Ubuntu**

```bash
cd /home/yama/ychat
git pull --ff-only origin premium-ui-v2
rm -rf .next
npm run build
sudo systemctl restart ychat.service
```

- [ ] **Step 3: Verify service and login page**

Confirm `ychat.service` is active and the public login page contains `Continue with Apple`.

- [ ] **Step 4: Test Apple OAuth end-to-end**

Expected: Apple authorization returns through Supabase callback and ends at `/chat` with a valid session.

- [ ] **Step 5: Test Google and email/password**

Expected: both still authenticate successfully after the Apple deployment.

### Task 5: Prepare iOS Build 3

**Files:**
- Modify locally as required: `ios/App/App.xcodeproj/project.pbxproj`
- Verify: `ios/App/App/Info.plist`
- Verify: `capacitor.config.ts`

**Interfaces:**
- Consumes: verified production web release from Task 4.
- Produces: App Store archive with marketing version `1.0` and build number `3` for `com.yamaahmadi.ychat`.

- [ ] **Step 1: Verify bundle and server URL**

Confirm bundle id is `com.yamaahmadi.ychat` and Capacitor points to `https://ychat.yamaahmadi.com`.

- [ ] **Step 2: Set build number to 3**

Update all `CURRENT_PROJECT_VERSION` entries for the app target to `3` without changing the bundle id.

- [ ] **Step 3: Open Xcode and verify signing/capabilities**

Use the correct Apple Developer team and verify the app signs successfully. Keep Sign in with Apple available for the configured app identifier.

- [ ] **Step 4: Test on iPhone and iPad simulator/device**

Verify Apple, Google, reviewer email/password, primary chat navigation, camera/microphone permission prompts where applicable, and no clipped login UI.

- [ ] **Step 5: Archive and upload Build 3**

Archive for App Store Connect, validate the archive, upload it, then select Build 3 in the existing version submission.

### Task 6: Prepare the Android release from the same web core

**Files:**
- Verify/modify local Android Capacitor project once its current path/version files are confirmed.
- Verify: `capacitor.config.ts`.

**Interfaces:**
- Consumes: same verified production web release from Task 4.
- Produces: updated signed APK for testing and AAB for Play distribution.

- [ ] **Step 1: Confirm Android project/application id and current versionCode/versionName**

Do not guess these values; inspect the local Android project first.

- [ ] **Step 2: Increment Android release version**

Increase `versionCode` by one and choose the matching release `versionName` without changing the application id.

- [ ] **Step 3: Sync Capacitor and build release artifacts**

Run Capacitor sync only after confirming it will not overwrite unrelated native changes. Produce a signed APK and AAB using the existing signing configuration.

- [ ] **Step 4: Install/test the signed APK**

Verify Apple (where web OAuth is offered), Google, email/password, chat navigation, media, notifications, and calls against the production URL.

- [ ] **Step 5: Gate release on parity**

Do not publish an Android package that advertises unavailable features or points at a different backend/web version than iOS.

### Task 7: Final release verification

**Files:**
- No source changes unless verification finds a defect.

**Interfaces:**
- Consumes: production web, iOS Build 3, Android signed release.
- Produces: evidence that the three surfaces are on the same functional release baseline.

- [ ] **Step 1: Re-run production web checks**

Verify public login UI, Apple/Google/email auth, privacy page, and reviewer account.

- [ ] **Step 2: Verify iOS App Review path**

Launch clean install -> Sign in -> reviewer credentials -> `/chat`; separately test Continue with Apple.

- [ ] **Step 3: Verify Android clean-install path**

Install signed APK -> authenticate -> `/chat` and confirm production URL behavior matches web/iOS.

- [ ] **Step 4: Submit iOS and retain Android artifacts**

Submit Build 3 with corrected review notes/privacy metadata. Keep APK/AAB release artifacts for the Android distribution step.

---

## Out of Scope for This Plan

QR linked-device implementation, message offline queues, reconnect/idempotency improvements, and end-to-end encryption are intentionally separate implementation plans. They begin only after the App Store repair release is stable.
