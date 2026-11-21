// Tiny client-side fetch helpers for the /api/savings/* routes.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Zod messages arrive as a JSON-stringified issue list; make them readable. */
function readableError(raw: unknown, status: number): string {
  if (typeof raw !== "string" || !raw) return `Request failed (${status})`;
  try {
    const issues = JSON.parse(raw) as { path?: (string | number)[]; message?: string }[];
    if (Array.isArray(issues) && issues.length > 0) {
      return issues
        .slice(0, 4)
        .map((i) => (i.path && i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join(" · ");
    }
  } catch {
    // plain string
  }
  return raw;
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty body
  }
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : null;
    throw new ApiError(readableError(msg, res.status), res.status);
  }
  return data as T;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
