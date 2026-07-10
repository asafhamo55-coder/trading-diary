"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, EyeOff, Loader2, Sparkles } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { buildCategoryTree, type HomeAccountDTO, type HomeCategoryDTO } from "@/lib/home";
import type { MerchantGroup } from "@/app/home/review/page";

export default function HomeReviewClient({
  categories,
  groups,
  totalRows,
}: {
  accounts: HomeAccountDTO[];
  categories: HomeCategoryDTO[];
  groups: MerchantGroup[];
  totalRows: number;
}) {
  const router = useRouter();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full">
      <div>
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Review queue</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Grouped by merchant. Categorize each place <span className="font-medium text-[var(--foreground)]">once</span> —
          it applies to all its transactions and is remembered for future imports.
        </p>
        {totalRows > 0 && (
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {groups.length} merchant{groups.length !== 1 ? "s" : ""} · {totalRows} transaction
            {totalRows !== 1 ? "s" : ""} to resolve
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#00D68F] mx-auto mb-4" />
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">All caught up</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Every merchant is categorized. New imports only land here when a new place appears.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
          {groups.map((g) => (
            <MerchantRow key={g.matcher} group={g} tree={tree} onDone={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}

function MerchantRow({
  group,
  tree,
  onDone,
}: {
  group: MerchantGroup;
  tree: ReturnType<typeof buildCategoryTree>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const out = group.total < 0;

  async function apply(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/home/categorize-merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matcher: group.matcher, ...body }),
      });
      if (res.ok) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)] truncate">
            {group.merchant}
          </span>
          {group.count > 1 && (
            <span className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0">
              ×{group.count}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] font-data truncate">{group.sampleRaw}</p>
      </div>
      <span
        className={cn(
          "text-sm font-data font-semibold w-24 text-right shrink-0",
          out ? "text-[#FF4D6A]" : "text-[#00D68F]"
        )}
      >
        {out ? "−" : "+"}
        {formatCurrency(Math.abs(group.total))}
      </span>
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />
      ) : (
        <select
          defaultValue=""
          onChange={(e) => e.target.value && apply({ categoryId: e.target.value })}
          className="max-w-[190px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
          title="Categorize this merchant (remembered for next time)"
        >
          <option value="" disabled>
            Categorize…
          </option>
          {tree.map((parent) => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.id}>{parent.name} (general)</option>
              {parent.children.map((c) => (
                <option key={c.id} value={c.id}>
                  {parent.name} › {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      <button
        onClick={() => apply({ exclude: true })}
        disabled={busy}
        title="Exclude this merchant (transfer / not spending)"
        className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
      >
        <EyeOff className="w-4 h-4" />
      </button>
    </div>
  );
}
