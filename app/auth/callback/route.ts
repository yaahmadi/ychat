import { NextResponse } from "next/server";
import { storeAppleRefreshToken } from "@/lib/supabase/apple-token-store";
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return loginError(appUrl, error.message);
    }


    const session = data.session;

    if (
      session?.user?.app_metadata?.provider === "apple" &&
      session.provider_refresh_token
    ) {
      try {
        await storeAppleRefreshToken(
          session.user.id,
          session.provider_refresh_token
        );
      } catch {
        console.error("Apple authorization storage failed.");
      }
    }

    return NextResponse.redirect(new URL(next, appUrl));
  } catch (error) {
    return loginError(
      appUrl,
      error instanceof Error ? error.message : "Authentication failed",
    );
  }
}
