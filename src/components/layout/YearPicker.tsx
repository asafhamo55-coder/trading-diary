"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

export default function YearPicker({
  years,
  selected,
}: {
  years: number[];
  selected: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setYear(y: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("year", String(y));
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 transition-colors focus-within:border-[var(--ring)]">
      <Calendar className="w-4 h-4 text-[var(--muted-foreground)]" />
      <select
        value={selected}
        onChange={(e) => setYear(Number(e.target.value))}
        className="bg-transparent text-sm font-medium text-[var(--foreground)] focus:outline-none cursor-pointer"
      >
        {years.map((y) => (
          <option key={y} value={y} className="bg-[var(--card)]">
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
