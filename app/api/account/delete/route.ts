import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inspectAccountStorage,
  removeAccountStorage,
} from "@/lib/supabase/account-cleanup";
import { revokeStoredAppleToken } from "@/lib/supabase/apple-token-store";

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

    if (
      process.env.ACCOUNT_DELETION_ENABLED !== "true" ||
      body?.execute !== true
    ) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        filesIdentified: fileCount,
        message: "Account deletion readiness check completed."
      });
    }

    const usesApple =
      user.identities?.some(
        identity => identity.provider === "apple"
      ) ||
      user.app_metadata?.provider === "apple";

    let appleManualRevocation = false;

    if (usesApple) {
      const revoked = await revokeStoredAppleToken(user.id);
      appleManualRevocation = !revoked;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return NextResponse.json(
        { error: "Please sign in again before deleting your account." },
        { status: 401 }
      );
    }

    const { error: revokeError } =
      await admin.auth.admin.signOut(
        session.access_token,
        "global"
      );

    if (revokeError) {
      throw new Error("Unable to revoke account sessions.");
    }

    const { error: transferError } = await admin.rpc(
      "transfer_deleted_user_groups",
      { departing_user: user.id }
    );

    if (transferError) {
      throw new Error("Group ownership transfer failed.");
    }

    const storageResult = await removeAccountStorage(
      admin,
      user.id
    );

    const { error: deletionError } =
      await admin.auth.admin.deleteUser(user.id, false);

    if (deletionError) {
      throw new Error("Account deletion failed.");
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
      appleManualRevocation,
      filesRemoved: storageResult.removed,
      message: "Your Ychat account has been permanently deleted."
    });

  } catch (error) {
    console.error(
      "[Account deletion]",
      error instanceof Error ? error.message : "Unknown failure"
    );
    return NextResponse.json(
      { error: "Unable to process account request." },
      { status: 500 }
    );
  }
}
