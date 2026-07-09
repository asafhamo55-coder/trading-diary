"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { DEMO_ERROR_DEFINITIONS, DEMO_TRADES } from "@/lib/demo-data";
import type { ErrorDefinition } from "@/lib/types";

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorDefinition[]>(DEMO_ERROR_DEFINITIONS);
  const [newErrorName, setNewErrorName] = useState("");

  // Compute error stats from trades
  const errorStats = useMemo(() => {
    const map = new Map<string, { count: number; totalPnL: number }>();
    errors.forEach((e) => map.set(e.id, { count: 0, totalPnL: 0 }));

    DEMO_TRADES.forEach((t) => {
      t.tradeErrors.forEach((te) => {
        const entry = map.get(te.errorDefinition.id);
        if (entry) {
          entry.count++;
          entry.totalPnL += t.totalPnL ?? 0;
        }
      });
    });

    return map;
  }, [errors]);

  const maxCount = Math.max(
    ...Array.from(errorStats.values()).map((v) => v.count),
    1
  );

  function handleAddError() {
    const name = newErrorName.trim();
    if (!name) return;
    const newErr: ErrorDefinition = {
      id: `err-${Date.now()}`,
      accountId: "demo-account",
      name,
      sortOrder: errors.length + 1,
    };
    setErrors((prev) => [...prev, newErr]);
    setNewErrorName("");
  }

  function handleRemoveError(id: string) {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Error Management</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Track and analyze trading mistakes
        </p>
      </div>

      {/* Add Error Form */}
      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-5 mb-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
          Add New Error Type
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newErrorName}
            onChange={(e) => setNewErrorName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddError()}
            placeholder="Error name..."
            className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[#3B82F6] transition-colors"
          />
          <button
            onClick={handleAddError}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#3B82F6]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Error List */}
      <div className="space-y-3">
        {errors.map((error) => {
          const stat = errorStats.get(error.id) ?? { count: 0, totalPnL: 0 };
          const barWidth = Math.round((stat.count / maxCount) * 100);

          return (
            <div
              key={error.id}
              className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-[#FFB547] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">
                      {error.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {stat.count} {stat.count === 1 ? "trade" : "trades"}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          stat.totalPnL >= 0
                            ? "text-[#00D68F]"
                            : "text-[#FF4D6A]"
                        )}
                      >
                        P&L Impact: {formatCurrency(stat.totalPnL)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveError(error.id)}
                  className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:bg-[var(--muted)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Frequency bar */}
              <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    stat.count > 0 ? "bg-[#FFB547]" : "bg-transparent"
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}

        {errors.length === 0 && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-12 text-center">
            <p className="text-[var(--muted-foreground)]">
              No error types defined. Add one above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
