import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

function loginError(message: string) {
  return NextResponse.redirect(
    `${appUrl}/auth/login?error=${encodeURIComponent(message)}`,
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const oauthError =
    requestUrl.searchParams.get("error_description") ||
    requestUrl.searchParams.get("error");

  if (oauthError) return loginError(oauthError);

  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") || "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";

  if (!code) return loginError("Missing authentication code");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) return loginError(error.message);

    return NextResponse.redirect(new URL(next, appUrl));
  } catch (error) {
    return loginError(
      error instanceof Error ? error.message : "Authentication failed",
    );
  }
}
