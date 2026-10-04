import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  LockKeyhole,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "Private messaging",
    text: "Fast one-to-one conversations with a clean, focused messaging experience.",
  },
  {
    icon: Users,
    title: "Groups & communities",
    text: "Keep group conversations, shared media and people together in one workspace.",
  },
  {
    icon: Phone,
    title: "Voice & video",
    text: "Connect through voice messages and supported voice and video calling.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy by design",
    text: "Authenticated accounts and protected routes keep your communication workspace controlled.",
  },
];

const capabilities = [
  "Direct messaging",
  "Group conversations",
  "Stories",
  "Media sharing",
  "Voice messages",
  "Voice & video calls",
];

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[var(--ychat-bg)] text-[var(--ychat-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--ychat-border)] bg-[color:var(--ychat-surface)]/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-3"
            aria-label="Ychat home"
          >
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-cyan-400/10 blur-md transition group-hover:bg-cyan-400/20" />
              <Image
                src="/icon-192.png"
                alt="Ychat logo"
                width={44}
                height={44}
                className="relative h-11 w-11 rounded-2xl border border-[var(--ychat-border)] shadow-sm"
                priority
              />
            </div>

            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight text-[var(--ychat-text)]">
                Ychat
              </div>
              <div className="truncate text-xs font-medium text-[var(--ychat-accent-strong)]">
                Private communication
              </div>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-xl border border-[var(--ychat-border)] bg-[var(--ychat-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--ychat-text-2)] shadow-sm transition hover:border-cyan-500/30 hover:bg-[var(--ychat-surface-2)] hover:text-[var(--ychat-text)] sm:px-4"
            >
              Sign in
            </Link>

            <Link
              href="/auth/login"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-3.5 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-105 hover:shadow-xl sm:px-4"
            >
              Open Ychat
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[var(--ychat-border)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3.5 py-1.5 text-xs font-bold text-[var(--ychat-accent-strong)]">
              <Sparkles className="h-3.5 w-3.5" />
              Ychat by Yama Ahmadi Services Informatiques
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.035em] text-[var(--ychat-text)] sm:text-5xl lg:text-7xl">
              Messaging that feels
              <span className="block bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                simple, private & premium.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--ychat-text-2)] sm:text-lg sm:leading-8">
              Ychat brings private chats, groups, stories, media, voice
              messages and calling together in one modern communication
              workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/login"
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-cyan-500/15 transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Start chatting
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/privacy"
                className="rounded-2xl border border-[var(--ychat-border)] bg-[var(--ychat-surface)] px-5 py-3.5 text-sm font-semibold text-[var(--ychat-text-2)] shadow-sm transition hover:border-cyan-500/25 hover:bg-[var(--ychat-surface-2)] hover:text-[var(--ychat-text)]"
              >
                Privacy & security
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-[var(--ychat-text-3)]">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Mobile ready
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                Desktop ready
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Account protected
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-indigo-500/10 blur-2xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-[var(--ychat-border)] bg-[var(--ychat-surface)] p-5 shadow-2xl shadow-slate-900/10 sm:p-6">
              <div className="flex items-center gap-4 border-b border-[var(--ychat-border)] pb-5">
                <Image
                  src="/icon-192.png"
                  alt="Ychat application icon"
                  width={68}
                  height={68}
                  className="h-[68px] w-[68px] rounded-2xl border border-[var(--ychat-border)] shadow-sm"
                />

                <div className="min-w-0">
                  <div className="text-xl font-bold text-[var(--ychat-text)]">
                    Ychat
                  </div>
                  <div className="mt-1 text-sm text-[var(--ychat-text-3)]">
                    Your communication workspace
                  </div>
                </div>

                <div className="ml-auto flex h-3 w-3 shrink-0">
                  <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400/40" />
                  <span className="relative h-3 w-3 rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                {capabilities.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--ychat-border)] bg-[var(--ychat-surface-2)] px-4 py-3.5 text-sm font-semibold text-[var(--ychat-text-2)] transition hover:-translate-y-0.5 hover:border-cyan-500/20 hover:bg-[var(--ychat-surface)]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600">
                      <span className="h-2 w-2 rounded-full bg-cyan-500" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ychat-accent-strong)]">
            Built around communication
          </div>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--ychat-text)] sm:text-4xl">
            Everything important, without the clutter.
          </h2>

          <p className="mt-4 leading-7 text-[var(--ychat-text-2)]">
            A focused communication experience designed to feel natural on
            desktop, tablet and mobile.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="group rounded-3xl border border-[var(--ychat-border)] bg-[var(--ychat-surface)] p-6 shadow-sm transition hover:-translate-y-1 hover:border-cyan-500/20 hover:shadow-xl hover:shadow-slate-900/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 transition group-hover:bg-cyan-500/15">
                <Icon className="h-5 w-5" />
              </div>

              <h3 className="mt-5 text-lg font-bold text-[var(--ychat-text)]">
                {title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-[var(--ychat-text-2)]">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--ychat-border)] bg-[var(--ychat-surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="text-[var(--ychat-text-3)]">
            © 2026 Ychat — Yama Ahmadi Services Informatiques
          </div>

          <nav className="flex flex-wrap gap-5">
            <Link
              href="/privacy"
              className="font-medium text-[var(--ychat-text-2)] transition hover:text-[var(--ychat-text)]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-medium text-[var(--ychat-text-2)] transition hover:text-[var(--ychat-text)]"
            >
              Terms of Service
            </Link>
            <Link
              href="/auth/login"
              className="font-semibold text-[var(--ychat-accent-strong)] transition hover:text-cyan-600"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
