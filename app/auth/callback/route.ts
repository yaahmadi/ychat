import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getConfiguredAppUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (configured) {
    return configured;
  }

  return new URL(request.url).origin;
}

function loginError(appUrl: string, message: string) {
  return NextResponse.redirect(
    `${appUrl}/auth/login?error=${encodeURIComponent(message)}`,
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appUrl = getConfiguredAppUrl(request);

  const oauthError =
    requestUrl.searchParams.get("error_description") ||
    requestUrl.searchParams.get("error");

  if (oauthError) {
    return loginError(appUrl, oauthError);
  }

  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") || "/chat";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/chat";

  if (!code) {
    return loginError(appUrl, "Missing authentication code");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return loginError(appUrl, error.message);
    }

    return NextResponse.redirect(new URL(next, appUrl));
  } catch (error) {
    return loginError(
      appUrl,
      error instanceof Error ? error.message : "Authentication failed",
    );
  }
}
