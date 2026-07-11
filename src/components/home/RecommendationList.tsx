import { TrendingDown, TrendingUp, AlertTriangle, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Recommendation } from "@/lib/home-coach";

const KIND_META: Record<Recommendation["kind"], { color: string; icon: React.ReactNode }> = {
  reduce: { color: "#FF4D6A", icon: <TrendingDown className="w-4 h-4" /> },
  grow: { color: "#00D68F", icon: <TrendingUp className="w-4 h-4" /> },
  watch: { color: "#FFB547", icon: <AlertTriangle className="w-4 h-4" /> },
  win: { color: "#3B82F6", icon: <Trophy className="w-4 h-4" /> },
};

export default function RecommendationList({ items }: { items: Recommendation[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)] py-2">
        Nothing pressing — things look balanced. Ask the co-pilot for deeper ideas.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((r) => {
        const meta = KIND_META[r.kind];
        return (
          <div key={r.id} className="flex gap-3 rounded-xl border border-[var(--border)] p-3.5">
            <span
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5"
              style={{ background: `${meta.color}1A`, color: meta.color }}
            >
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[var(--foreground)]">{r.title}</span>
                {r.monthlyImpact != null && r.monthlyImpact >= 5 && (
                  <span
                    className="text-[10px] font-semibold rounded px-1.5 py-0.5 font-data"
                    style={{ background: `${meta.color}1A`, color: meta.color }}
                  >
                    ~{formatCurrency(r.monthlyImpact)}/mo
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5 leading-relaxed">{r.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
