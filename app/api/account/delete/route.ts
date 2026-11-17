import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectAccountStorage } from "@/lib/supabase/account-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const configuredOrigin =
      process.env.NEXT_PUBLIC_APP_URL;

    if (!configuredOrigin) {
      return NextResponse.json(
        { error: "Server configuration unavailable." },
        { status: 503 }
      );
    }

    const origin = request.headers.get("origin");

    if (origin !== new URL(configuredOrigin).origin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    if (body?.confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Deletion confirmation required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { error: verificationError } =
      await admin.auth.admin.getUserById(user.id);

    if (verificationError) {
      return NextResponse.json(
        { error: "Account verification failed." },
        { status: 403 }
      );
    }

    const inventory = await inspectAccountStorage(
      admin,
      user.id
    );

    const fileCount = Object.values(inventory)
      .reduce((total, files) => total + files.length, 0);

    return NextResponse.json({
      ok: true,
      dryRun: true,
      filesIdentified: fileCount,
      message: "Account deletion readiness check completed."
    });

  } catch {
    return NextResponse.json(
      { error: "Unable to process account request." },
      { status: 500 }
    );
  }
}
