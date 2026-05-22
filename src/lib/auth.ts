// Single-password auth — Edge-compatible (no Node crypto)
// Cookie value = SHA-256(APP_PASSWORD + ":auth-v1"), middleware compares on every request.

export const AUTH_COOKIE = "app_auth";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedAuthCookie(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  return sha256Hex(password + ":auth-v1");
}

export async function verifyPassword(submitted: string): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password) return false;
  if (submitted.length !== password.length) return false;
  // Constant-time compare
  let mismatch = 0;
  for (let i = 0; i < submitted.length; i++) {
    mismatch |= submitted.charCodeAt(i) ^ password.charCodeAt(i);
  }
  return mismatch === 0;
}
