import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { InfoTip } from "./info-tip";
import type { ExplainKey } from "@/lib/explain";

/**
 * DataTable — a styled table inside a horizontal scroll container
 * (HomeownerHub port). Server-friendly: holds no state. Sorting is a URL
 * concern — pass the current `sort` and a `sortHref` builder and the
 * headers become links (with `aria-sort`).
 *
 * Sticky header (inside `maxHeight`), row hover, `density`,
 * `mobile="cards"` (each row becomes a labelled card under `md`), `empty`
 * and `footer` slots.
 */
export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Right-aligned, tabular figures. Use for money and counts. */
  numeric?: boolean;
  className?: string;
  sortable?: boolean;
  hideOnMobile?: boolean;
  mobilePrimary?: boolean;
  mobileAside?: boolean;
  hideBelowLg?: boolean;
  /** Glossary key: an ⓘ after the header (desktop table only). */
  tip?: ExplainKey;
}

export type SortDirection = "asc" | "desc";

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: React.ReactNode;
  showCaption?: boolean;
  stickyFirstColumn?: boolean;
  /** Wrap in a Card (default). */
  framed?: boolean;
  className?: string;
  /** `compact` for dense ledgers; `comfortable` default. */
  density?: "comfortable" | "compact";
  sort?: { key: string; direction: SortDirection };
  sortHref?: (key: string, direction: SortDirection) => string;
  linkAs?: React.ElementType;
  mobile?: "scroll" | "cards";
  maxHeight?: string;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  /**
   * Client-side sorting: headers become buttons that call this instead of
   * links. Takes precedence over `sortHref`.
   */
  onSort?: (key: string, direction: SortDirection) => void;
  /**
   * Make whole rows clickable (mouse convenience). Keep a real link or button
   * inside the row for keyboard and screen-reader users; controls inside the
   * row should stop propagation.
   */
  onRowClick?: (row: T) => void;
}

/** Just the scroll container, for tables too irregular for `DataTable`. */
export function TableScroll({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      tabIndex={0}
      className={cn(
        "w-full overflow-x-auto print:overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function SortHeader({
  col,
  sort,
  sortHref,
  onSort,
  linkAs: LinkAs,
}: {
  col: { key: string; header: React.ReactNode; numeric?: boolean };
  sort?: { key: string; direction: SortDirection };
  sortHref?: (key: string, direction: SortDirection) => string;
  onSort?: (key: string, direction: SortDirection) => void;
  linkAs: React.ElementType;
}) {
  const active = sort?.key === col.key;
  const next: SortDirection = active && sort?.direction === "asc" ? "desc" : "asc";
  const Icon = !active ? ChevronsUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;
  const Tag: React.ElementType = onSort ? "button" : LinkAs;
  const tagProps = onSort
    ? { type: "button", onClick: () => onSort(col.key, next) }
    : { href: sortHref?.(col.key, next) ?? "#" };
  return (
    <Tag
      {...tagProps}
      className={cn(
        "group -mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 no-underline transition-colors hover:bg-subtle hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "text-foreground",
        col.numeric && "flex-row-reverse"
      )}
    >
      <span>{col.header}</span>
      <Icon
        className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-40 group-hover:opacity-80")}
        aria-hidden
      />
    </Tag>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  showCaption = false,
  stickyFirstColumn = false,
  framed = true,
  className,
  density = "comfortable",
  sort,
  sortHref,
  linkAs = Link,
  mobile = "scroll",
  maxHeight,
  empty,
  footer,
  rowClassName,
  onSort,
  onRowClick,
}: DataTableProps<T>) {
  const sortable = Boolean(onSort || sortHref);
  const sticky = (index: number, head = false) =>
    stickyFirstColumn && index === 0
      ? cn("sticky left-0 z-[1]", head ? "z-[3] bg-subtle" : "bg-surface group-hover/row:bg-subtle")
      : "";
  const cellPad = density === "compact" ? "px-3 py-2" : "px-4 py-3";
  const isEmpty = rows.length === 0 && empty !== undefined;

  const table = (
    <TableScroll
      className={cn(mobile === "cards" && "hidden md:block", maxHeight && "overflow-y-auto")}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        {caption ? (
          <caption className={showCaption ? "px-4 py-2 text-left text-xs text-muted-foreground" : "sr-only"}>
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr>
            {columns.map((col, i) => {
              const ariaSort =
                sort?.key === col.key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={col.sortable && sortable ? (ariaSort ?? "none") : ariaSort}
                  className={cn(
                    "sticky top-0 z-[2] whitespace-nowrap border-b border-border bg-subtle text-xs font-medium text-muted-foreground",
                    density === "compact" ? "px-3 py-2" : "px-4 py-2.5",
                    col.numeric && "text-right",
                    col.hideBelowLg && "hidden lg:table-cell",
                    sticky(i, true),
                    col.className
                  )}
                >
                  {col.sortable && sortable ? (
                    <SortHeader col={col} sort={sort} sortHref={sortHref} onSort={onSort} linkAs={linkAs} />
                  ) : (
                    col.header
                  )}
                  {col.tip ? <InfoTip tip={col.tip} className="ms-1" /> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "group/row transition-colors duration-150 hover:bg-subtle/70 [&:last-child>td]:border-b-0",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row)
                )}
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn(
                      "border-b border-border align-middle text-foreground",
                      cellPad,
                      col.numeric && "num text-right",
                      col.hideBelowLg && "hidden lg:table-cell",
                      sticky(i),
                      col.className
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableScroll>
  );

  const primaryIndex = Math.max(0, columns.findIndex((c) => c.mobilePrimary));
  const asideIndex = columns.findIndex((c, i) => c.mobileAside && i !== primaryIndex && !c.hideOnMobile);
  const cards =
    mobile === "cards" ? (
      <ul className="divide-y divide-border md:hidden" aria-label={typeof caption === "string" ? caption : undefined}>
        {isEmpty ? (
          <li>{empty}</li>
        ) : (
          rows.map((row) => (
            <li key={rowKey(row)} className={cn("space-y-2 px-4 py-3.5", rowClassName?.(row))}>
              {asideIndex >= 0 ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm font-medium text-foreground">{columns[primaryIndex]?.cell(row)}</div>
                  <div className="num shrink-0 text-right text-base font-semibold text-foreground">
                    <span className="sr-only">{columns[asideIndex].header}: </span>
                    {columns[asideIndex].cell(row)}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-medium text-foreground">{columns[primaryIndex]?.cell(row)}</div>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {columns.map((col, i) =>
                  i === primaryIndex || i === asideIndex || col.hideOnMobile ? null : (
                    <React.Fragment key={col.key}>
                      <dt className="text-xs text-muted-foreground">{col.header}</dt>
                      <dd className={cn("min-w-0 text-right text-foreground", col.numeric && "num")}>
                        {col.cell(row)}
                      </dd>
                    </React.Fragment>
                  )
                )}
              </dl>
            </li>
          ))
        )}
      </ul>
    ) : null;

  const body = (
    <>
      {table}
      {cards}
      {footer ? <div className="border-t border-border">{footer}</div> : null}
    </>
  );

  return framed ? (
    <Card className={cn("overflow-hidden", className)}>{body}</Card>
  ) : (
    <div className={className}>{body}</div>
  );
}
