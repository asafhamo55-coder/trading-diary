"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import Logo from "@/components/layout/Logo";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const unconfigured = search.get("error") === "unconfigured";

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    unconfigured
      ? "Auth not configured. Set APP_PASSWORD in Vercel and redeploy."
      : null
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Login failed");
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-[var(--muted-foreground)]" />
            <h1 className="text-base font-semibold text-[var(--foreground)]">
              Sign in to continue
            </h1>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mb-6">
            Enter the access password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-[var(--muted)] border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                placeholder="•••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-[#FF4D6A]/10 border border-[#FF4D6A]/30 text-[#FF4D6A] text-xs px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !password}
              className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
