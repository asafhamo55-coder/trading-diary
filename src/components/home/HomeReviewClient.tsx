"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, EyeOff, Loader2, Trash2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  buildCategoryTree,
  type HomeAccountDTO,
  type HomeCategoryDTO,
  type HomeTransactionDTO,
} from "@/lib/home";

export default function HomeReviewClient({
  accounts,
  categories,
  transactions,
}: {
  accounts: HomeAccountDTO[];
  categories: HomeCategoryDTO[];
  transactions: HomeTransactionDTO[];
}) {
  const router = useRouter();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

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
          Transactions we couldn&apos;t confidently categorize. Assign a category (it&apos;s
          remembered for next time), or exclude transfers.
        </p>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#00D68F] mx-auto mb-4" />
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">All caught up</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Nothing needs review. New imports will land here when they need a category.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
          {transactions.map((t) => (
            <ReviewRow
              key={t.id}
              tx={t}
              tree={tree}
              accountName={accountById.get(t.homeAccountId)?.name}
              onChange={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewRow({
  tx,
  tree,
  accountName,
  onChange,
}: {
  tx: HomeTransactionDTO;
  tree: ReturnType<typeof buildCategoryTree>;
  accountName?: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const out = tx.amount < 0;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/home/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/home/transactions/${tx.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-xs text-[var(--muted-foreground)] font-data w-14 shrink-0">{tx.date}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--foreground)] truncate">{tx.description}</p>
        <p className="text-xs text-[var(--muted-foreground)] truncate">
          {accountName} · <span className="font-data">{tx.rawDescription}</span>
        </p>
      </div>
      <span
        className={cn(
          "text-sm font-data font-semibold w-24 text-right shrink-0",
          out ? "text-[#FF4D6A]" : "text-[#00D68F]"
        )}
      >
        {out ? "−" : "+"}
        {formatCurrency(Math.abs(tx.amount))}
      </span>
      <select
        defaultValue=""
        disabled={busy}
        onChange={(e) => e.target.value && patch({ categoryId: e.target.value })}
        className="max-w-[190px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
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
      <button
        onClick={() => patch({ isExcluded: true, needsReview: false, excludeReason: "Excluded in review" })}
        disabled={busy}
        title="Exclude (transfer / not spending)"
        className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        title="Delete"
        className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:bg-[var(--muted)] transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
