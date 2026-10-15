# YChat Multi-Device and Reliability Design

## Goal

Upgrade YChat across the web app, iOS package, and Android package so the three surfaces share one dependable authentication, device-linking, messaging, and release architecture. The immediate release remains compatible with the current Next.js + Supabase + Capacitor stack.

## Scope

This design covers three subprojects that ship independently in this order:

1. Unified authentication and QR device linking.
2. Messaging/network reliability.
3. Cross-platform packaging and release parity.

End-to-end encryption beyond the existing transport security is a separate security project because it changes message/key storage, multi-device key distribution, backups, and server trust assumptions.

## 1. Unified Authentication and QR Device Linking

### Existing authentication

Keep Apple, Google, and email/password as the core account/login methods. Phone number is optional profile data and phone OTP verification is optional/provider-dependent; lack of an SMS provider must not block account creation, App Store review, or normal YChat use. The web, iOS Capacitor shell, and Android Capacitor shell use the same hosted YChat application and callback flow.

### Optional phone verification

If a phone delivery provider is configured, YChat may offer optional phone verification after account creation. OTP generation, expiration, retry limits, and verification may run on YChat's own server, but delivery to a real phone number still requires an external SMS/WhatsApp transport or a physical modem/SIM. The product must not claim free SMS delivery unless an actual no-cost delivery path exists.

### QR linking model

A signed-in primary device can authorize a new browser/device without transmitting the account password.

The new device creates a short-lived `device_link_requests` record containing a random high-entropy token hash, expiration, status, requesting platform/browser metadata, and no reusable credential. The displayed QR contains only the public request identifier plus the one-time secret needed to prove possession.

The signed-in phone scans the QR, fetches the pending request, displays the requesting device information, and requires explicit confirmation. Approval is performed through an authenticated server endpoint. The server marks the request approved and issues a one-time exchange code. The requesting device exchanges that code once for its own independent session. Requests expire automatically and cannot be replayed.

### Linked device management

Create a `user_devices` registry with one row per logical device/session family. Store user id, generated device id, platform, display name, created time, last seen time, last IP-derived coarse region when available, push capability state, and revocation time. Never store passwords or provider secrets.

Settings gains a **Linked devices** screen showing current and other devices. Users can revoke any other device. Revocation invalidates that device's application session/server-side device authorization and prevents future refresh by the YChat device layer.

### Interfaces

- `POST /api/devices/link/start` — create a short-lived link request for the unauthenticated requesting device.
- `GET /api/devices/link/status?id=...` — poll/subscribe to request state using the request proof.
- `POST /api/devices/link/approve` — authenticated primary device approves a pending request.
- `POST /api/devices/link/exchange` — requesting device performs one-time exchange after approval.
- `GET /api/devices` — list the current user's devices.
- `DELETE /api/devices/:deviceId` — revoke another device.

All state-changing endpoints validate origin where applicable, rate-limit attempts, enforce short expirations, and use cryptographically random tokens.

## 2. Messaging and Network Reliability

### Message identity and idempotency

Every outgoing message receives a client-generated UUID before network transmission. The database enforces uniqueness per conversation/sender for the client message id so reconnect/retry cannot create duplicates.

### Delivery state

Client state is `queued -> sending -> sent -> delivered/read` where supported. Failed transient requests return to the queue with bounded exponential backoff and jitter. Permanent validation/permission failures are surfaced immediately and are not retried indefinitely.

### Offline queue

Persist pending text-message operations locally so short app closures and network loss do not discard them. Attachments keep metadata and resumable/retry state but must not silently duplicate uploads.

### Realtime recovery

Supabase Realtime remains the primary live path. On reconnect, the client performs a cursor/time-based catch-up query before declaring the conversation synchronized. Realtime events and catch-up results are de-duplicated by message id.

### Standard-network resilience

Use normal HTTPS/TLS and WebSocket transports. Support reconnect/backoff, HTTPS request fallback for message submission, conservative timeouts, bandwidth-aware media behavior, and TURN over TLS/443 for WebRTC where configured. The product will not add covert traffic-obfuscation mechanisms intended specifically to evade government network controls.

### Poor-network mode

When repeated timeouts/high latency are detected, prioritize text and metadata, postpone automatic large-media downloads, reduce call/media quality where supported, and display a non-blocking degraded-connection indicator.

## 3. Cross-Platform Packaging and Release Parity

### Shared web core

`https://ychat.yamaahmadi.com` remains the canonical hosted application. Web fixes are deployed and verified before native packaging. iOS and Android Capacitor shells point to the same canonical HTTPS URL.

### iOS

- Bundle id remains `com.yamaahmadi.ychat`.
- Sign in with Apple stays enabled in Apple Developer and Supabase.
- Increment App Store build number for each submission.
- Test on iPhone and iPad, including the reviewer login path and Apple/Google/email login.
- Validate camera, microphone, notifications, attachments, calls, stories, and device-link scanning permissions/flows before archive.

### Android

- Keep the existing Android application id.
- Increment versionCode/versionName for release builds.
- Produce both signed AAB for Play distribution and APK for direct/internal testing when required.
- Verify the same authentication, device linking, messaging, media, notification, and call flows as web/iOS.

### Release gate

A release is eligible only when:

1. Production web build succeeds and the canonical URL serves the expected commit.
2. Apple, Google, and email/password flows are tested successfully; optional phone verification is tested only when a delivery provider is configured and is not a release blocker.
3. Reviewer/demo account is validated before iOS submission.
4. iPad layout and primary chat flows pass.
5. Android signed release installs and authenticates successfully.
6. No platform advertises a feature that is unavailable in its packaged build.

## Privacy and Security

- QR tokens are short-lived, random, single-use, and stored server-side only as hashes where practical.
- Device authorization is explicit; scanning alone never links a device.
- Device revocation is visible and user-controlled.
- Avoid collecting device contacts unless a future feature genuinely requires it and the privacy declarations/permissions are updated first.
- Application telemetry must not be used for advertising tracking unless the product deliberately adopts tracking and implements the corresponding platform consent requirements.
- Secrets, signing keys, OAuth client secrets, and Apple `.p8` material are never committed to Git.

## Error Handling

Expired/reused QR requests show a clear regenerate action. Approval on a revoked/expired request fails closed. Network loss during approval/exchange is idempotent so retry cannot create multiple device sessions. Authentication provider failures preserve existing login alternatives. Realtime loss falls back to catch-up synchronization rather than silently losing messages.

## Testing Strategy

Each subproject uses red-green-refactor tests before implementation. API tests cover expired tokens, replay, unauthorized approval, cross-user access, duplicate exchange, and revocation. Messaging tests cover offline enqueue, retry, idempotency, reconnect catch-up, and duplicate realtime events. Packaging verification uses production URLs and release builds on iOS/iPadOS and Android rather than development-only localhost behavior.

## Delivery Order

1. Finish the current App Store rejection repair: Apple-login functional test, reviewer account, privacy metadata, iPad verification, and Build 3 submission.
2. Ship QR/device linking as the next independently testable feature set while keeping phone verification optional.
3. Ship message/network reliability improvements.
4. Build and release synchronized web/iOS/Android versions.
5. Design end-to-end encryption separately before claiming Signal-class cryptographic guarantees.
