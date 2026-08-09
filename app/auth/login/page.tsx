"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMethod = "email" | "phone";
type AccountMode = "signin" | "signup";

function getRedirectBase() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (typeof window === "undefined") {
    return configured || "http://localhost:3000";
  }

  const origin = window.location.origin.replace(/\/$/, "");
  const host = window.location.hostname;

  // Local development must stay on localhost.
  if (host === "localhost" || host === "127.0.0.1") {
    return origin;
  }

  // Production should use the canonical Ychat URL configured in Vercel.
  return configured || origin;
}

function friendlyAuthError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "Authentication failed. Please try again.";

  if (/provider.*not enabled|unsupported provider/i.test(message)) {
    return "This login provider is not enabled in Supabase.";
  }

  if (/redirect|callback/i.test(message) && /not allowed|invalid/i.test(message)) {
    return `${message} Check the Supabase Redirect URLs and Google OAuth callback settings.`;
  }

  if (/signups? not allowed/i.test(message)) {
    return "New account signup is disabled in Supabase Authentication settings.";
  }

  if (/sms|twilio|phone provider/i.test(message) && /error|invalid|failed/i.test(message)) {
    return `${message} Check the Supabase Phone provider and Twilio Messaging Service configuration.`;
  }

  return message;
}

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
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("error");
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const authCallbackUrl = useMemo(
    () => `${getRedirectBase()}/auth/callback`,
    [],
  );

  function normalizePhone(value: string) {
    return value.replace(/[\s()-]/g, "");
  }

  function clearNotices() {
    setError(null);
    setMessage(null);
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    clearNotices();

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (signInError) throw signInError;
        if (!data.session) throw new Error("No login session was created.");

        router.replace("/");
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authCallbackUrl,
          data: {
            display_name: displayName.trim() || email.trim().split("@")[0],
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setMessage(
        "Account created. Check your email and use the confirmation link to finish signup.",
      );
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function requestPhoneOtp() {
    const normalized = normalizePhone(phone);

    if (!normalized.startsWith("+") || normalized.length < 8) {
      setError(
        "Enter the number in international format, for example +33612345678.",
      );
      return;
    }

    if (mode === "signup" && !displayName.trim()) {
      setError("Enter your display name before requesting the signup code.");
      return;
    }

    setLoading(true);
    clearNotices();

    try {
      const supabase = createClient();

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
        options: {
          shouldCreateUser: mode === "signup",
          data:
            mode === "signup"
              ? { display_name: displayName.trim() || normalized }
              : undefined,
        },
      });

      if (otpError) throw otpError;

      setOtpSent(true);
      setMessage("Verification code sent by SMS.");
    } catch (err) {
      const text = friendlyAuthError(err);

      if (
        /user not found|signups? not allowed/i.test(
          err instanceof Error ? err.message : "",
        ) &&
        mode === "signin"
      ) {
        setError(
          "No phone account exists for this number. Choose Create account first.",
        );
      } else {
        setError(text);
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    clearNotices();

    try {
      const supabase = createClient();

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token: otp.trim(),
        type: "sms",
      });

      if (verifyError) throw verifyError;
      if (!data.session) {
        throw new Error(
          "Phone verification succeeded but no session was created.",
        );
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    clearNotices();

    try {
      const supabase = createClient();

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authCallbackUrl,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (oauthError) throw oauthError;
    } catch (err) {
      setError(friendlyAuthError(err));
      setGoogleLoading(false);
    }
  }

  function toggleMode() {
    setMode((current) => (current === "signin" ? "signup" : "signin"));
    clearNotices();
    setPassword("");
    setOtp("");
    setOtpSent(false);
  }

  function changeMethod(next: AuthMethod) {
    setMethod(next);
    clearNotices();
    setOtp("");
    setOtpSent(false);
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0f1d33] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-500";
  const primaryButtonClass =
    "w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main className="min-h-dvh overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_35%),#030712] px-2.5 py-2.5 sm:flex sm:items-center sm:justify-center sm:px-5 sm:py-5">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#07111f]/95 p-4 shadow-2xl shadow-cyan-950/20 sm:p-5 md:max-w-lg lg:max-w-md">
        <div className="flex items-center gap-2.5">
          <Image
            src="/icon-192.png"
            alt="Ychat"
            width={42}
            height={42}
            className="h-10 w-10 rounded-xl sm:h-11 sm:w-11"
            priority
          />
          <div className="min-w-0">
            <Image
              src="/brand/yama-logo.png"
              alt="Yama Ahmadi Services Informatiques"
              width={170}
              height={58}
              className="h-7 w-auto max-w-full object-contain object-left sm:h-8"
            />
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-cyan-400">
              Ychat
            </p>
          </div>
        </div>

        <div className="mt-3">
          <h1 className="text-2xl font-semibold leading-tight text-slate-100 sm:text-[26px]">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Google, email/password, or mobile number.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.38Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.39l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.39 13.93A6.03 6.03 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.48H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.52l3.35-2.59Z" />
            <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.95 14.69 2 12 2a10 10 0 0 0-8.96 5.48l3.35 2.59C7.18 7.7 9.39 5.94 12 5.94Z" />
          </svg>
          {googleLoading
            ? "Connecting..."
            : mode === "signin"
              ? "Continue with Google"
              : "Sign up with Google"}
        </button>

        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            or
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid grid-cols-2 rounded-xl bg-[#0b1728] p-1">
          <button
            type="button"
            onClick={() => changeMethod("email")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium sm:text-sm ${
              method === "email"
                ? "bg-cyan-500 text-slate-950"
                : "text-slate-400"
            }`}
          >
            <Mail className="h-4 w-4" />
            Email
          </button>
          <button
            type="button"
            onClick={() => changeMethod("phone")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium sm:text-sm ${
              method === "phone"
                ? "bg-cyan-500 text-slate-950"
                : "text-slate-400"
            }`}
          >
            <Phone className="h-4 w-4" />
            Mobile
          </button>
        </div>

        {method === "email" ? (
          <form onSubmit={handleEmailSubmit} className="mt-3 space-y-2.5">
            {mode === "signup" && (
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block">Display name</span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className={inputClass}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="block text-xs text-slate-300">
              <span className="mb-1 block">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>

            <label className="block text-xs text-slate-300">
              <span className="mb-1 block">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                placeholder={
                  mode === "signin"
                    ? "Enter your password"
                    : "Choose a secure password"
                }
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
            </label>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className={primaryButtonClass}
            >
              {loading
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyPhoneOtp} className="mt-3 space-y-2.5">
            {mode === "signup" && (
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block">Display name</span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className={inputClass}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="block text-xs text-slate-300">
              <span className="mb-1 block">Mobile number</span>
              <input
                type="tel"
                required
                value={phone}
                disabled={otpSent}
                onChange={(event) => setPhone(event.target.value)}
                className={`${inputClass} disabled:opacity-60`}
                placeholder="+33612345678"
                autoComplete="tel"
              />
            </label>

            {otpSent ? (
              <>
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block">SMS verification code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, ""))
                    }
                    className={`${inputClass} text-center text-lg tracking-[.3em]`}
                    placeholder="000000"
                    autoComplete="one-time-code"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className={primaryButtonClass}
                >
                  {loading ? "Verifying..." : "Verify & continue"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setMessage(null);
                  }}
                  className="w-full py-1 text-xs text-slate-400 hover:text-white"
                >
                  Use a different number
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void requestPhoneOtp()}
                disabled={loading}
                className={primaryButtonClass}
              >
                {loading
                  ? "Sending code..."
                  : mode === "signin"
                    ? "Send login code"
                    : "Send signup code"}
              </button>
            )}

            <div className="flex gap-2 rounded-lg border border-cyan-500/10 bg-cyan-500/5 p-2 text-[10px] leading-4 text-slate-400 sm:text-xs">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
              <span>SMS OTP requires Supabase Phone auth and a working Twilio provider.</span>
            </div>
          </form>
        )}

        {error && (
          <div
            role="alert"
            className="mt-2.5 max-h-24 overflow-auto rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs leading-4 text-rose-300"
          >
            {error}
          </div>
        )}

        {message && (
          <div className="mt-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs leading-4 text-emerald-300">
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={toggleMode}
          className="mt-3 w-full py-1 text-center text-xs text-slate-400 transition hover:text-cyan-300 sm:text-sm"
        >
          {mode === "signin"
            ? "New to Ychat? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
