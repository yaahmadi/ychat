Ychat Google Branding Fix

Copy the app folder from this package into the root of your Ychat project and merge/replace files.

Files:
- app/page.tsx                 Public Google-verifiable Ychat homepage
- app/chat/page.tsx            Protected chat workspace moved to /chat
- app/privacy/page.tsx         Public privacy policy
- app/terms/page.tsx           Public terms
- PATCH_AUTH.ps1               Updates login/callback redirects to /chat

After copying, run from the Ychat project root:
  powershell -ExecutionPolicy Bypass -File .\PATCH_AUTH.ps1
  npm run build
  git add app PATCH_AUTH.ps1
  git commit -m "Add public Ychat homepage privacy terms and protected chat route"
  git push

After Vercel deploys, verify:
  https://ychat.yamaahmadi.com
  https://ychat.yamaahmadi.com/privacy
  https://ychat.yamaahmadi.com/terms
  https://ychat.yamaahmadi.com/chat
