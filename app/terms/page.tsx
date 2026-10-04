import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Ychat",
  description: "Terms of Service for Ychat.",
};

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-[#f7fafc] px-4 py-10 text-slate-900 dark:bg-[#030712] dark:text-slate-100 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-[#07111f]/90 p-6 sm:p-9">
        <Link href="/" className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
          ← Back to Ychat
        </Link>

        <h1 className="mt-5 text-3xl font-semibold">Ychat Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Effective date: August 9, 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">1. Service</h2>
            <p className="mt-2">
              Ychat is a messaging web application and progressive web app operated by Yama Ahmadi Services Informatiques. By accessing or using Ychat, you agree to these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Accounts</h2>
            <p className="mt-2">
              You are responsible for providing accurate account information, protecting your credentials and devices, and all activity performed through your account. You must not impersonate another person or misuse another person&apos;s account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Acceptable use</h2>
            <p className="mt-2">
              You must not use Ychat to violate applicable law, abuse or harass others, distribute malware, interfere with the service, attempt unauthorized access, exploit security vulnerabilities, or transmit content you do not have the right to share.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. User content</h2>
            <p className="mt-2">
              You remain responsible for content you submit through Ychat. You grant the limited permissions necessary for Ychat and its service providers to store, process, transmit and display that content solely to operate the service and provide the features you request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Availability and changes</h2>
            <p className="mt-2">
              Ychat may be updated, modified, interrupted or temporarily unavailable. Features may change as the application evolves. We do not guarantee uninterrupted or error-free availability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Third-party services</h2>
            <p className="mt-2">
              Ychat may depend on third-party services for hosting, authentication, databases, email, SMS, media, or other infrastructure. Your use of those services may also be subject to their applicable terms and policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Suspension or termination</h2>
            <p className="mt-2">
              Access may be suspended or terminated where reasonably necessary to protect Ychat, its users or providers; address abuse or security risks; comply with legal requirements; or enforce these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Disclaimer and liability</h2>
            <p className="mt-2">
              Ychat is provided on an as-available basis to the extent permitted by applicable law. Nothing in these Terms excludes rights or liabilities that cannot legally be excluded or limited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Privacy</h2>
            <p className="mt-2">
              Our processing of personal information is described in the{" "}
              <Link href="/privacy" className="text-cyan-300 hover:underline">
                Ychat Privacy Policy
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">10. Contact</h2>
            <p className="mt-2">
              Questions about these Terms may be sent to{" "}
              <a className="text-cyan-300 hover:underline" href="mailto:support@yamaahmadi.fr">
                support@yamaahmadi.fr
              </a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
