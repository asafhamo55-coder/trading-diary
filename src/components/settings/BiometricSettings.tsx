"use client";

import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import {
  disableBiometric,
  isBiometricEnabled,
  isBiometricSupported,
  isStandalonePWA,
  registerBiometric,
} from "@/lib/biometric";
import { cn } from "@/lib/utils";

export default function BiometricSettings() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [standalone, setStandalone] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    setEnabled(isBiometricEnabled());
    setSupported(isBiometricSupported());
    setStandalone(isStandalonePWA());
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    const r = await registerBiometric();
    setBusy(false);
    if (r.ok) {
      setEnabled(true);
      setMessage({ ok: true, text: "Face ID lock enabled" });
    } else {
      setMessage({ ok: false, text: r.error ?? "Setup failed" });
    }
  }

  function disable() {
    disableBiometric();
    setEnabled(false);
    setMessage({ ok: true, text: "Face ID lock disabled" });
  }

  return (
    <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#3B82F6]/10 shrink-0">
          <Fingerprint className="w-5 h-5 text-[#3B82F6]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Face ID Lock
        </h2>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mb-5 leading-relaxed">
        Require Face ID (or Touch ID) when the app is opened from your home
        screen. Has no effect in a regular browser.
      </p>

      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors",
          enabled
            ? "border-[#00D68F]/30 bg-[#00D68F]/5"
            : "border-[var(--border)] bg-[var(--muted)]"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full shrink-0",
              enabled ? "bg-[#00D68F]/15" : "bg-[var(--card)]"
            )}
          >
            {enabled ? (
              <ShieldCheck className="w-5 h-5 text-[#00D68F]" />
            ) : (
              <ShieldOff className="w-5 h-5 text-[var(--muted-foreground)]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {enabled ? "Enabled" : "Disabled"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {enabled
                ? "Face ID is required to open the installed app."
                : "App opens immediately without biometric check."}
            </p>
          </div>
        </div>
        {enabled ? (
          <button
            type="button"
            onClick={disable}
            className="pressable px-4 py-2 rounded-lg border border-[#FF4D6A]/40 text-[#FF4D6A] text-sm font-semibold hover:bg-[#FF4D6A]/10 transition-colors shrink-0"
          >
            Disable
          </button>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy || !supported}
            className="pressable inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-semibold shadow-sm shadow-[#3B82F6]/20 hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-60 disabled:pointer-events-none shrink-0"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? "Setting up…" : "Enable"}
          </button>
        )}
      </div>

      {!supported && (
        <p className="text-xs text-[#FFB547] mt-3">
          This browser doesn&apos;t support biometric credentials. Use Safari on
          iOS / iPadOS or a Chromium browser on a device with Face ID / Touch
          ID.
        </p>
      )}
      {supported && !standalone && (
        <p className="text-xs text-[var(--muted-foreground)] mt-3">
          Tip: install the app via Safari &rarr; Share &rarr; Add to Home Screen
          to make this lock active.
        </p>
      )}

      {message && (
        <div
          className={cn(
            "mt-4 rounded-lg border px-3 py-2 text-sm",
            message.ok
              ? "border-[#00D68F]/30 bg-[#00D68F]/10 text-[#00D68F]"
              : "border-[#FF4D6A]/30 bg-[#FF4D6A]/10 text-[#FF4D6A]"
          )}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
