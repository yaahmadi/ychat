# Ychat

Ychat is a Next.js + Supabase realtime communication PWA with Yama Ahmadi Services Informatiques branding.

## v1.0.0 features

- Google, email/password and mobile-number SMS OTP authentication
- Realtime 1:1 and group text messaging
- Emoji and sticker messages
- Photo, video, audio, document and archive attachments
- Inline photo/video preview and private signed file downloads
- Voice-message recording and playback
- Voice calls and video calls using WebRTC
- Small-group voice/video mesh calls
- 24-hour text, photo and video Stories
- Editable display name, username and profile photo
- People, Chats, Stories, Groups, Files, Admin and Settings views
- Realtime profile, conversation, message, file and story updates
- Installable PWA for Android, iPhone/iPad and desktop
- Responsive phone/desktop chat UI inspired by modern messaging apps

## Setup

Keep your real Supabase values in `.env.local`.

Run `supabase/FIX_CURRENT_DATABASE.sql` in the Supabase SQL Editor. The SQL is intended to be rerunnable.

```powershell
npm install
npm run lint
npm run build
npm run dev
```

Local URL: `http://localhost:3000`

## Phone OTP

Enable Supabase Phone Auth and configure an SMS provider. For Twilio, the Messaging Service SID must start with `MG`. An `SK...` value is an API Key SID and is not a Messaging Service SID.

## Production

Use HTTPS and set `NEXT_PUBLIC_APP_URL` to your public URL. HTTPS is required for microphone/camera access and PWA installation on normal origins.

For reliable WebRTC calls across restrictive corporate/mobile networks, configure a TURN server using the optional variables in `.env.example`.

Browser-to-browser calling works while the app/PWA is running. Reliable incoming ringing while the app is completely closed requires a separate Web Push/native push infrastructure.
