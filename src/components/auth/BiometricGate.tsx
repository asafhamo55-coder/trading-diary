"use client";

import { useEffect, useState } from "react";
import { Fingerprint, ShieldAlert } from "lucide-react";
import {
  isBiometricEnabled,
  isSessionUnlocked,
  isStandalonePWA,
  verifyBiometric,
} from "@/lib/biometric";

type Status = "checking" | "unlocked" | "locked";

export default function BiometricGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Within the same session, don't re-prompt on navigations
    if (isSessionUnlocked()) {
      setStatus("unlocked");
      return;
    }

    // Only enforce when launched as an installed PWA (per user request:
    // "only while it's shared via my iPhone" — i.e. from the home screen).
    if (!isStandalonePWA()) {
      setStatus("unlocked");
      return;
    }

    if (!isBiometricEnabled()) {
      setStatus("unlocked");
      return;
    }

    setStatus("locked");
  }, []);

  async function unlock() {
    setBusy(true);
    setError(null);
    const result = await verifyBiometric();
    setBusy(false);
    if (result.ok) {
      setStatus("unlocked");
    } else {
      setError(result.error ?? "Unlock failed");
    }
  }

  if (status === "checking") {
    // Brief blank during initial check — iOS shows its splash screen anyway
    return (
      <div className="fixed inset-0 bg-[var(--background)]" aria-hidden />
    );
  }

  if (status === "locked") {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--background)] p-6">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#00D68F] mb-6 shadow-lg">
          <Fingerprint className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          App Locked
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-8 text-center max-w-xs">
          Unlock Trading Journal with Face ID to continue.
        </p>
        <button
          type="button"
          onClick={unlock}
          disabled={busy}
          className="px-6 py-3 rounded-lg bg-[#3B82F6] text-white font-medium hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-60 min-w-[220px]"
        >
          {busy ? "Verifying…" : "Unlock with Face ID"}
        </button>
        {error && (
          <div className="mt-6 flex items-start gap-2 text-sm text-[#FF4D6A] max-w-xs">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
