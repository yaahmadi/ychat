"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

type AuthMethod = "email" | "phone";
type AccountMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AccountMode>("signin");
  const [method, setMethod] = useState<AuthMethod>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function normalizePhone(value: string) {
    return value.replace(/[\s()-]/g, "");
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        router.replace("/");
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${APP_URL}/auth/callback`,
          data: { display_name: displayName.trim() || email.trim().split("@")[0] },
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }
      setMessage("Account created. Check your email to confirm your account before signing in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function requestPhoneOtp() {
    const normalized = normalizePhone(phone);
    if (!normalized.startsWith("+") || normalized.length < 8) {
      setError("Enter your mobile number in international format, for example +33612345678.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
        options: {
          shouldCreateUser: true,
          data: { display_name: displayName.trim() || normalized },
        },
      });
      if (otpError) throw otpError;
      setOtpSent(true);
      setMessage("Verification code sent by SMS.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send SMS verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token: otp.trim(),
        type: "sms",
      });
      if (verifyError) throw verifyError;
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${APP_URL}/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Google sign-in.");
      setGoogleLoading(false);
    }
  }

  function toggleMode() {
    setMode((current) => (current === "signin" ? "signup" : "signin"));
    setError(null);
    setMessage(null);
    setPassword("");
    setOtp("");
    setOtpSent(false);
  }

  function changeMethod(next: AuthMethod) {
    setMethod(next);
    setError(null);
    setMessage(null);
    setOtp("");
    setOtpSent(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_35%),#030712] px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#07111f]/95 p-7 shadow-2xl shadow-cyan-950/20 sm:p-8">
        <div className="flex items-center gap-3">
          <Image src="/icon-192.png" alt="Ychat" width={52} height={52} className="rounded-2xl" priority />
          <div>
            <Image src="/brand/yama-logo.png" alt="Yama Ahmadi Services Informatiques" width={190} height={66} className="h-9 w-auto object-contain object-left" />
            <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-cyan-400">Ychat</p>
          </div>
        </div>

        <h1 className="mt-4 text-3xl font-semibold text-slate-100">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in with Google, email/password, or your mobile number.</p>

        <button type="button" onClick={handleGoogleLogin} disabled={googleLoading || loading} className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.38Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.39l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.03 6.03 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.48H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.52l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.95 14.69 2 12 2a10 10 0 0 0-8.96 5.48l3.35 2.59C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>
          {googleLoading ? "Connecting to Google..." : mode === "signin" ? "Continue with Google" : "Sign up with Google"}
        </button>

        <div className="my-5 flex items-center gap-4"><div className="h-px flex-1 bg-white/10"/><span className="text-xs uppercase tracking-widest text-slate-500">or</span><div className="h-px flex-1 bg-white/10"/></div>

        <div className="grid grid-cols-2 rounded-2xl bg-[#0b1728] p-1">
          <button type="button" onClick={() => changeMethod("email")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm ${method === "email" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}><Mail className="h-4 w-4"/>Email</button>
          <button type="button" onClick={() => changeMethod("phone")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm ${method === "phone" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}><Phone className="h-4 w-4"/>Mobile</button>
        </div>

        {method === "email" ? (
          <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
            {mode === "signup" && <label className="block text-sm text-slate-300"><span className="mb-2 block">Display name</span><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0f1d33] px-4 py-3 outline-none focus:border-cyan-500" placeholder="Your name" autoComplete="name" /></label>}
            <label className="block text-sm text-slate-300"><span className="mb-2 block">Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0f1d33] px-4 py-3 outline-none focus:border-cyan-500" placeholder="name@example.com" autoComplete="email" /></label>
            <label className="block text-sm text-slate-300"><span className="mb-2 block">Password</span><input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0f1d33] px-4 py-3 outline-none focus:border-cyan-500" placeholder={mode === "signin" ? "Enter your password" : "Choose a secure password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>
            <button type="submit" disabled={loading || googleLoading} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">{loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
        ) : (
          <form onSubmit={verifyPhoneOtp} className="mt-5 space-y-4">
            {mode === "signup" && <label className="block text-sm text-slate-300"><span className="mb-2 block">Display name</span><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0f1d33] px-4 py-3 outline-none focus:border-cyan-500" placeholder="Your name" autoComplete="name" /></label>}
            <label className="block text-sm text-slate-300"><span className="mb-2 block">Mobile number</span><input type="tel" required value={phone} disabled={otpSent} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0f1d33] px-4 py-3 outline-none focus:border-cyan-500 disabled:opacity-60" placeholder="+33612345678" autoComplete="tel" /></label>
            {otpSent ? <><label className="block text-sm text-slate-300"><span className="mb-2 block">SMS verification code</span><input type="text" inputMode="numeric" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} className="w-full rounded-2xl border border-white/10 bg-[#0f1d33] px-4 py-3 text-center text-xl tracking-[.35em] outline-none focus:border-cyan-500" placeholder="000000" autoComplete="one-time-code" /></label><button type="submit" disabled={loading || otp.length < 6} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">{loading ? "Verifying..." : "Verify & continue"}</button><button type="button" onClick={() => { setOtpSent(false); setOtp(""); setMessage(null); }} className="w-full text-sm text-slate-400 hover:text-white">Use a different number</button></> : <button type="button" onClick={() => void requestPhoneOtp()} disabled={loading} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">{loading ? "Sending code..." : mode === "signin" ? "Send login code" : "Send signup code"}</button>}
            <div className="flex gap-2 rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300"/><span>Phone login uses Supabase SMS OTP. Your Supabase project must have Phone auth and an SMS provider enabled.</span></div>
          </form>
        )}

        {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        {message && <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</div>}

        <button type="button" onClick={toggleMode} className="mt-6 w-full text-center text-sm text-slate-400 transition hover:text-cyan-300">{mode === "signin" ? "New to Ychat? Create an account" : "Already have an account? Sign in"}</button>
      </div>
    </main>
  );
}
