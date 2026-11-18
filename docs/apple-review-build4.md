# YChat iOS App Review — October 30, 2026

Apple reviewed 1.0 (3), iPad Air 11-inch M3 with iPadOS 27.2. **Do not submit Build 4 until all checks pass.**

## Functional fixes required
- [ ] **Camera crash (2.1a)**: local Mac `ios/App/App/Info.plist` now includes NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSMicrophoneUsageDescription, but that native project is not in this Git branch. Preserve it and symbolicate Apple's attached .ips crash report. Test Settings → Change photo → Take Photo on a physical iPad and an iPhone. Test denied permission, cancel, HEIC and large images. Confirm the new permissions are in the archive itself.
- [ ] **Permanent deletion (5.1.1v)**: Add Settings → Account Center → Delete account with irreversible confirmation, verified server session and a protected deletion service. Do not delete users directly from the browser.
- [ ] **Shared-data safety**: production schema has ON DELETE CASCADE for `conversations.created_by`, `messages.sender_id`, `attachments.uploader_id`. Deleting a member can erase other members' conversations. Design a migration for neutral attribution / group reassignment, preserving other members' content; validate RLS, triggers, Supabase Storage ownership, push subscriptions and Apple credentials. Do not implement an unsafe raw `deleteUser()` call.
- [ ] **Sign-in experience (Guideline 4)**: email/password UI is in-app, but Google/Apple `signInWithOAuth` redirects. Use a compliant native auth session/Apple sign-in flow and return into the app with a verified session. Test Apple, Google, email login and sign-up on physical iOS devices.
- [ ] **Review account (2.1a)**: create two disposable populated test accounts with chats and contacts; give valid demo credentials in App Store Connect securely (not Git). Verify chats, contacts, profile and media work on the reviewer account.
- [ ] **Screenshots (2.3.3)**: replace 6.5-inch screenshots with screenshots from the current YChat release showing actual chats and contacts; no mock UIs.
- [ ] **Subscriptions (2.1b)**: in this branch, marketing text no longer implies a live purchase flow. Confirm there are no paid entitlements, purchases, or payments elsewhere in production before telling Apple that YChat is free. If any exist, disclose them accurately and review IAP requirements.

## Required recording and submission
- [ ] Record from a physical iPhone or iPad: sign in → Settings → Account Center → Delete Account → confirmation → successful deletion.
- [ ] Attach the recording in App Review Information and supply demo credentials.
- [ ] Raise iOS build number from 3 to 4, archive, distribute to TestFlight, verify camera and authentication, then resubmit.
- [ ] Reply to Apple with an accurate feature-by-feature explanation, not a blanket claim of resolution.

## Data deletion acceptance tests
- Authenticated Alice deletes her own account; Bob's groups and messages remain accessible.
- Alice's contacts, personal profile, private files, sessions, push subscriptions and owned storage are cleaned up per retention policy.
- Alice cannot delete Bob's account by modifying a request.
- Expired/stale sessions cannot issue deletion; errors do not leave a misleading success UI.
- Apple and Google login, email/password account creation, and repeat deletion attempts are handled safely.

This checklist intentionally contains **no production-destructive SQL**. The destructive changes require schema-specific tests and explicit deployment review.
