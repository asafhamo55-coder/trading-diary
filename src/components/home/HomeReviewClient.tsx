"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, EyeOff, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import HomeCategorySelect, { type Selection } from "@/components/home/HomeCategorySelect";
import {
  buildCategoryTree,
  type HomeAccountDTO,
  type HomeCategoryDTO,
  type PropertyOption,
} from "@/lib/home";
import type { MerchantGroup } from "@/app/home/review/page";

export default function HomeReviewClient({
  categories,
  groups,
  totalRows,
  properties,
}: {
  accounts: HomeAccountDTO[];
  categories: HomeCategoryDTO[];
  groups: MerchantGroup[];
  totalRows: number;
  properties: PropertyOption[];
}) {
  const router = useRouter();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full">
      <div>
        <Link
          href="/home"
          className="pressable inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Review queue</h1>
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
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-12 text-center shadow-sm">
          <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00D68F]/12 mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#00D68F]" />
          </span>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">All caught up</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto">
            Every merchant is categorized. New imports only land here when a new place appears.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] shadow-sm overflow-hidden">
          {groups.map((g) => (
            <MerchantRow
              key={g.matcher}
              group={g}
              tree={tree}
              properties={properties}
              onDone={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MerchantRow({
  group,
  tree,
  properties,
  onDone,
}: {
  group: MerchantGroup;
  tree: ReturnType<typeof buildCategoryTree>;
  properties: PropertyOption[];
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
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--muted)]/40">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)] truncate">
            {group.merchant}
          </span>
          {group.count > 1 && (
            <span className="text-[10px] font-medium font-data rounded px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0">
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
        <HomeCategorySelect
          tree={tree}
          properties={properties}
          categoryId={null}
          propertyId={null}
          placeholder="Categorize…"
          onSelect={(sel: Selection) => {
            if (sel.propertyId) apply({ propertyId: sel.propertyId });
            else if (sel.categoryId) apply({ categoryId: sel.categoryId });
          }}
          className="max-w-[200px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
        />
      )}
      <button
        onClick={() => apply({ exclude: true })}
        disabled={busy}
        title="Exclude this merchant (transfer / not spending)"
        className="pressable p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors disabled:opacity-50"
      >
        <EyeOff className="w-4 h-4" />
      </button>
    </div>
  );
}
