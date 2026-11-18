export async function revokeAppleToken(
  token: string,
  tokenType: "refresh_token" | "access_token"
): Promise<void> {
  if (typeof window !== "undefined") {
    throw new Error("Server-side access only.");
  }

  const clientId = process.env.APPLE_CLIENT_ID;
  const clientSecret = process.env.APPLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Apple configuration is missing.");
  }

  if (!token.trim()) {
    throw new Error("Apple authorization token is missing.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token,
    token_type_hint: tokenType,
  });

  const response = await fetch(
    "https://appleid.apple.com/auth/revoke",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Apple token revocation failed (${response.status}).`
    );
  }
}
