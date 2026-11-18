import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptAppleToken,
  decryptAppleToken,
} from "@/lib/supabase/apple-token-crypto";
import { revokeAppleToken } from "@/lib/supabase/apple-revoke";

export async function storeAppleRefreshToken(
  userId: string,
  refreshToken: string
) {
  if (!refreshToken.trim()) {
    return;
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("apple_oauth_tokens")
    .upsert({
      user_id: userId,
      encrypted_token: encryptAppleToken(refreshToken),
      token_type: "refresh_token",
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });

  if (error) {
    throw new Error("Unable to store Apple authorization.");
  }
}

export async function revokeStoredAppleToken(
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("apple_oauth_tokens")
    .select("encrypted_token, token_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to retrieve Apple authorization.");
  }

  if (!data) {
    return false;
  }

  const token = decryptAppleToken(data.encrypted_token);

  if (
    data.token_type !== "refresh_token" &&
    data.token_type !== "access_token"
  ) {
    throw new Error("Invalid stored token type.");
  }

  await revokeAppleToken(token, data.token_type);

  const { error: deleteError } = await admin
    .from("apple_oauth_tokens")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error("Unable to clear revoked authorization.");
  }

  return true;
}
