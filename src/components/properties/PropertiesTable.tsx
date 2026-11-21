"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { useDisplayCurrency } from "@/components/ui/currency";
import {
  appreciationOf,
  equityOf,
  groupByBuilding,
  sortEntries,
  type BuildingEntry,
  type PropertyRow,
  type PropertySortKey,
  type SortDir,
} from "@/lib/property-portfolio";
import { ArchiveButton, LeaseStatus, TenantLine, fmtPct, toneClass } from "./PropertyCard";

type TableRow =
  | { kind: "row"; row: PropertyRow; nested: boolean }
  | { kind: "building"; entry: Extract<BuildingEntry, { kind: "building" }>; expanded: boolean };

const keyOf = (t: TableRow) => (t.kind === "row" ? t.row.id : `bldg:${t.entry.key}`);

export function PropertiesTable({
  rows,
  elapsed,
  busyId,
  onArchive,
}: {
  rows: PropertyRow[];
  elapsed: number;
  busyId: string | null;
  onArchive: (id: string) => void;
}) {
  const router = useRouter();
  const { money } = useDisplayCurrency();
  const [sort, setSort] = React.useState<{ key: PropertySortKey; direction: SortDir }>({
    key: "property",
    direction: "asc",
  });
  // Buildings start expanded so every unit is visible; folding is per session.
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const partialYear = elapsed > 0 && elapsed < 12;

  const flat = React.useMemo<TableRow[]>(() => {
    const entries = sortEntries(groupByBuilding(rows, elapsed), sort.key, sort.direction);
    const out: TableRow[] = [];
    for (const e of entries) {
      if (e.kind === "single") out.push({ kind: "row", row: e.row, nested: false });
      else {
        const expanded = !collapsed.has(e.key);
        out.push({ kind: "building", entry: e, expanded });
        if (expanded) for (const u of e.units) out.push({ kind: "row", row: u, nested: true });
      }
    }
    return out;
  }, [rows, elapsed, sort, collapsed]);

  const toggle = (key: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const compactMoney = (v: number | null) => (v == null ? "—" : money(v, "USD", { compact: true }));

  const columns: DataTableColumn<TableRow>[] = [
    {
      key: "property",
      header: "Property",
      sortable: true,
      className: "min-w-[12rem]",
      cell: (t) => {
        if (t.kind === "building") {
          const e = t.entry;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-expanded={t.expanded}
                aria-label={`${t.expanded ? "Collapse" : "Expand"} ${e.title}, ${e.units.length} units`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  toggle(e.key);
                }}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight
                  className={cn("size-4 transition-transform motion-reduce:transition-none", t.expanded && "rotate-90")}
                  aria-hidden
                />
              </button>
              <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{e.title}</p>
                <p className="truncate text-xs text-muted-foreground">{e.units.length} units · building total</p>
              </div>
            </div>
          );
        }
        const r = t.row;
        return (
          <div className={cn("min-w-0", t.nested && "pl-9")}>
            <Link
              href={`/properties/${r.id}`}
              onClick={(ev) => ev.stopPropagation()}
              className="block truncate rounded-sm font-medium text-foreground no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.nested && r.unit ? `Unit ${r.unit}` : r.title}
            </Link>
            <p className="max-w-[13rem] truncate text-xs text-muted-foreground">{r.address}</p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      className: "min-w-[11rem]",
      cell: (t) => {
        if (t.kind === "building") {
          const { leasedUnits, units } = t.entry.totals;
          return (
            <StatusPill
              tone={leasedUnits === units ? "success" : leasedUnits === 0 ? "danger" : "warning"}
              label={`${leasedUnits}/${units} leased`}
            />
          );
        }
        return (
          <div className="min-w-0 space-y-1">
            <LeaseStatus row={t.row} />
            <TenantLine row={t.row} className="max-w-[12rem]" />
          </div>
        );
      },
    },
    {
      key: "net",
      header: partialYear ? "Net YTD" : "Net",
      numeric: true,
      sortable: true,
      cell: (t) => {
        const net = t.kind === "building" ? t.entry.totals.net : t.row.net;
        return (
          <span className={cn("font-semibold", toneClass(net), t.kind === "building" && "font-bold")}>
            {money(net, "USD", { signed: true })}
          </span>
        );
      },
    },
    {
      key: "coc",
      header: "Cash-on-cash",
      numeric: true,
      sortable: true,
      cell: (t) => {
        // A building's units share one figure, shown on the building row.
        if (t.kind === "row" && t.nested) return <span className="text-xs text-muted-foreground">in building</span>;
        const v = t.kind === "building" ? t.entry.totals.cashOnCashPct : t.row.cashOnCashPct;
        return <span className={toneClass(v)}>{fmtPct(v)}</span>;
      },
    },
    {
      key: "yield",
      header: "Yield",
      numeric: true,
      sortable: true,
      className: "hidden xl:table-cell",
      cell: (t) => {
        const v = t.kind === "building" ? t.entry.totals.yieldPct : t.row.yieldPct;
        return <span className={v == null ? "text-muted-foreground" : undefined}>{v == null ? "—" : `${v.toFixed(1)}%`}</span>;
      },
    },
    {
      key: "value",
      header: "Value",
      numeric: true,
      sortable: true,
      cell: (t) => compactMoney(t.kind === "building" ? t.entry.totals.value : t.row.currentValue),
    },
    {
      key: "mortgage",
      header: "Mortgage",
      numeric: true,
      sortable: true,
      hideBelowLg: true,
      cell: (t) => {
        const v = t.kind === "building" ? t.entry.totals.mortgage : t.row.mortgageBalance;
        return v == null ? <span className="text-xs text-muted-foreground">not set</span> : compactMoney(v);
      },
    },
    {
      key: "equity",
      header: "Equity",
      numeric: true,
      sortable: true,
      cell: (t) => compactMoney(t.kind === "building" ? t.entry.totals.equity : equityOf(t.row)),
    },
    {
      key: "appreciation",
      header: "Appr.",
      numeric: true,
      sortable: true,
      cell: (t) => {
        const v = t.kind === "building" ? t.entry.totals.appreciationPct : appreciationOf(t.row);
        return <span className={toneClass(v)}>{fmtPct(v == null ? null : v * 100)}</span>;
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 pl-0",
      cell: (t) =>
        t.kind === "row" ? (
          <ArchiveButton
            archived={false}
            busy={busyId === t.row.id}
            title={t.row.title}
            onClick={() => onArchive(t.row.id)}
          />
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={flat}
      rowKey={keyOf}
      caption="Rental properties"
      density="compact"
      sort={sort}
      onSort={(key, direction) => setSort({ key: key as PropertySortKey, direction })}
      onRowClick={(t) => (t.kind === "row" ? router.push(`/properties/${t.row.id}`) : toggle(t.entry.key))}
      rowClassName={(t) => (t.kind === "building" ? "bg-subtle/50" : undefined)}
    />
  );
}
