"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setLoading(false);
        return;
      }
      router.replace("/auth/login");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session) {
        setLoading(false);
        return;
      }
      if (event === "SIGNED_OUT") router.replace("/auth/login");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-[#07111f]/90 px-6 py-5 text-sm text-slate-300">
          Loading secure workspace...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
