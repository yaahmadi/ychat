import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, MessageCircle, Phone, ShieldCheck, Users } from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "Private messaging",
    text: "Chat one-to-one with people in your Ychat network using a clean, responsive messaging experience.",
  },
  {
    icon: Users,
    title: "Group conversations",
    text: "Create group chats and keep conversations, media and shared information together.",
  },
  {
    icon: Phone,
    title: "Voice & video",
    text: "Use supported voice and video calling features directly from the Ychat web application.",
  },
  {
    icon: ShieldCheck,
    title: "Account-based access",
    text: "Ychat uses authenticated accounts and protected application routes to control access to the chat workspace.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[#030712] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050b14]/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Ychat home">
            <Image
              src="/icon-192.png"
              alt="Ychat logo"
              width={42}
              height={42}
              className="h-10 w-10 rounded-xl"
              priority
            />
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight tracking-tight">Ychat</div>
              <div className="truncate text-xs text-cyan-300">Secure messaging</div>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400/50 hover:text-white sm:px-4"
            >
              Sign in
            </Link>
            <Link
              href="/auth/login"
              className="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 sm:px-4"
            >
              Open
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-20">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs font-medium text-cyan-200">
              <LockKeyhole className="h-3.5 w-3.5" />
              Ychat by Yama Ahmadi Services Informatiques
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ychat
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Private chats, groups, stories, voice messages, and voice/video calls in a clean mobile-first workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/auth/login"
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Start chatting
              </Link>
              <Link
                href="/privacy"
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-400/50"
              >
                Privacy policy
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#07111f]/90 p-5 shadow-2xl shadow-cyan-950/20 sm:p-7">
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              <Image
                src="/icon-192.png"
                alt="Ychat application icon"
                width={72}
                height={72}
                className="rounded-2xl"
              />
              <div>
                <div className="text-2xl font-semibold">Ychat</div>
                <div className="mt-1 text-sm text-slate-400">
                  Web & progressive web app
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {["Direct chat", "Group chat", "Media sharing", "Stories", "Voice messages", "Voice & video calls"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">What Ychat is for</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Ychat provides an authenticated communication workspace for people who want a modern messaging experience across desktop, tablet and mobile devices.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-[#07111f]/70 p-5">
              <Icon className="h-5 w-5 text-cyan-300" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#050b14]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-7 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>© 2026 Ychat — Yama Ahmadi Services Informatiques</div>
          <nav className="flex flex-wrap gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <Link href="/auth/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
