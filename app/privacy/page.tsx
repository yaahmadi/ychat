import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Ychat",
  description: "Privacy Policy for Ychat.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#030712] px-4 py-10 text-slate-100 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#07111f]/90 p-6 sm:p-9">
        <Link href="/" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
          ← Back to Ychat
        </Link>

        <h1 className="mt-5 text-3xl font-semibold">Ychat Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Effective date: August 9, 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white">1. About Ychat</h2>
            <p className="mt-2">
              Ychat is a messaging web application and progressive web app operated by Yama Ahmadi Services Informatiques. It provides authenticated messaging, group communication, media-sharing, stories, and supported voice/video communication features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Information we process</h2>
            <p className="mt-2">
              Depending on how you use Ychat, we may process account information such as your name, email address, phone number, profile information, authentication provider identifiers, and information needed to operate your account. We also process content and metadata you choose to submit through Ychat, such as messages, attachments, profile images and story content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Authentication providers</h2>
            <p className="mt-2">
              Ychat may allow sign-in through Google, email/password, and phone-based one-time passwords. These services may process information according to their own privacy policies. Ychat uses Supabase authentication infrastructure and may use an SMS provider for phone verification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. How information is used</h2>
            <p className="mt-2">
              Information is used to authenticate users, provide messaging and communication features, maintain user profiles, protect the service, troubleshoot technical issues, prevent abuse, and operate and improve Ychat.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Sharing and service providers</h2>
            <p className="mt-2">
              We may use infrastructure and service providers to operate Ychat, including hosting, database, authentication and messaging providers. Information may be processed by those providers only as needed to provide the relevant service or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Data security</h2>
            <p className="mt-2">
              We use reasonable technical and organizational measures to protect Ychat and its accounts. No internet service can guarantee absolute security, and users should protect their credentials and devices.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Data retention and deletion</h2>
            <p className="mt-2">
              Information may be retained for as long as necessary to operate Ychat, provide requested functionality, meet legal obligations, resolve disputes, and protect the service. Where supported, account-related information may be deleted or corrected upon a valid request, subject to legal and technical requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Your choices and rights</h2>
            <p className="mt-2">
              Depending on applicable law, you may have rights to request access, correction, deletion, restriction, or other actions concerning personal information associated with your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Contact</h2>
            <p className="mt-2">
              Privacy and account questions may be sent to{" "}
              <a className="text-cyan-300 hover:underline" href="mailto:support@yamaahmadi.fr">
                support@yamaahmadi.fr
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">10. Changes</h2>
            <p className="mt-2">
              This Privacy Policy may be updated when Ychat, its providers, or applicable requirements change. The effective date above will be updated when material changes are published.
            </p>
          </section>
        </div>

        <div className="mt-9 border-t border-white/10 pt-6 text-sm">
          <Link href="/terms" className="text-cyan-300 hover:text-cyan-200">
            View Terms of Service
          </Link>
        </div>
      </article>
    </main>
  );
}
