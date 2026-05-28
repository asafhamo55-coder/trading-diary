// WebAuthn-based biometric (Face ID / Touch ID) gate for the PWA.
//
// Credentials are stored locally in the device's secure enclave; only the
// credential ID (a public handle) is kept in localStorage. There is no server
// component — this is a local re-auth gate on top of the existing session.

const CRED_KEY = "biometric-credential-id";
const ENABLED_KEY = "biometric-enabled";
const SESSION_UNLOCKED_KEY = "biometric-unlocked";

export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.PublicKeyCredential !== "undefined";
}

export function isBiometricEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(ENABLED_KEY) === "1" &&
    !!window.localStorage.getItem(CRED_KEY)
  );
}

export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_UNLOCKED_KEY) === "1";
}

export function markSessionUnlocked(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_UNLOCKED_KEY, "1");
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const str = atob(b64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

export async function registerBiometric(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isBiometricSupported()) {
    return { ok: false, error: "Biometric authentication is not supported on this device" };
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Trading Journal Pro", id: window.location.hostname },
        user: {
          id: userId,
          name: "trader@local",
          displayName: "Trader",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) return { ok: false, error: "No credential returned" };

    window.localStorage.setItem(CRED_KEY, bufferToBase64Url(credential.rawId));
    window.localStorage.setItem(ENABLED_KEY, "1");
    markSessionUnlocked();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Setup failed";
    return { ok: false, error: msg };
  }
}

export async function verifyBiometric(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isBiometricSupported()) {
    return { ok: false, error: "Biometric authentication is not supported" };
  }
  const credIdB64 = window.localStorage.getItem(CRED_KEY);
  if (!credIdB64) {
    return { ok: false, error: "No credential registered" };
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            id: base64UrlToBuffer(credIdB64),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    });

    if (!assertion) return { ok: false, error: "No assertion returned" };
    markSessionUnlocked();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return { ok: false, error: msg };
  }
}

export function disableBiometric(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CRED_KEY);
  window.localStorage.removeItem(ENABLED_KEY);
  window.sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
}
