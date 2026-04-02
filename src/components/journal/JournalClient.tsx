"use client";

import { useState } from "react";
import { BookOpen, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import type { MonthlyReview } from "@/lib/types";

interface ReviewForm {
  goal1: string;
  goal2: string;
  goal3: string;
  goalsMet: string;
  monthlyConclusions: string;
  keyLessons: string;
  riskUnit: string;
  portfolioStartValue: string;
  portfolioEndValue: string;
}

function getFormForMonth(month: number, reviews: MonthlyReview[]): ReviewForm {
  const review = reviews.find((r) => r.month === month);
  if (!review) {
    return {
      goal1: "",
      goal2: "",
      goal3: "",
      goalsMet: "",
      monthlyConclusions: "",
      keyLessons: "",
      riskUnit: "",
      portfolioStartValue: "",
      portfolioEndValue: "",
    };
  }
  return {
    goal1: review.goal1 ?? "",
    goal2: review.goal2 ?? "",
    goal3: review.goal3 ?? "",
    goalsMet: review.goalsMet ?? "",
    monthlyConclusions: review.monthlyConclusions ?? "",
    keyLessons: review.keyLessons ?? "",
    riskUnit: review.riskUnit?.toString() ?? "",
    portfolioStartValue: review.portfolioStartValue?.toString() ?? "",
    portfolioEndValue: review.portfolioEndValue?.toString() ?? "",
  };
}

export default function JournalClient({ reviews }: { reviews: MonthlyReview[] }) {
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [form, setForm] = useState<ReviewForm>(() => getFormForMonth(1, reviews));

  function handleMonthChange(month: number) {
    setSelectedMonth(month);
    setForm(getFormForMonth(month, reviews));
  }

  function handleChange(field: keyof ReviewForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    alert(`Monthly review for ${MONTH_NAMES[selectedMonth - 1]} saved (demo).`);
  }

  const inputClass =
    "w-full bg-[#1C2130] border border-[#2A3040] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#8892A6] focus:outline-none focus:border-[#3B82F6] transition-colors";
  const textareaClass =
    "w-full bg-[#1C2130] border border-[#2A3040] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#8892A6] focus:outline-none focus:border-[#3B82F6] transition-colors resize-y min-h-[80px]";
  const labelClass = "block text-sm font-medium text-[#8892A6] mb-1";

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#E8ECF4]">Monthly Journal</h1>
        <p className="text-[#8892A6] text-sm mt-1">
          Review and reflect on your trading month
        </p>
      </div>

      {/* Month Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MONTH_NAMES.map((name, i) => (
          <button
            key={i}
            onClick={() => handleMonthChange(i + 1)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              selectedMonth === i + 1
                ? "bg-[#3B82F6] text-white"
                : "bg-[#1C2130] text-[#8892A6] hover:text-[#E8ECF4] border border-[#2A3040]"
            )}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-lg font-semibold text-[#E8ECF4]">
            {MONTH_NAMES[selectedMonth - 1]} Review
          </h2>
        </div>

        <div className="space-y-6">
          {/* Monthly Goals */}
          <div>
            <h3 className="text-sm font-semibold text-[#E8ECF4] mb-3">
              Monthly Goals
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Goal 1</label>
                <input
                  type="text"
                  value={form.goal1}
                  onChange={(e) => handleChange("goal1", e.target.value)}
                  placeholder="Enter goal..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Goal 2</label>
                <input
                  type="text"
                  value={form.goal2}
                  onChange={(e) => handleChange("goal2", e.target.value)}
                  placeholder="Enter goal..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Goal 3</label>
                <input
                  type="text"
                  value={form.goal3}
                  onChange={(e) => handleChange("goal3", e.target.value)}
                  placeholder="Enter goal..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Goals Review */}
          <div>
            <label className={labelClass}>Goals Review</label>
            <textarea
              value={form.goalsMet}
              onChange={(e) => handleChange("goalsMet", e.target.value)}
              placeholder="How did you do on your goals?"
              className={textareaClass}
            />
          </div>

          {/* Monthly Conclusions */}
          <div>
            <label className={labelClass}>Monthly Conclusions</label>
            <textarea
              value={form.monthlyConclusions}
              onChange={(e) =>
                handleChange("monthlyConclusions", e.target.value)
              }
              placeholder="Overall conclusions for this month..."
              className={textareaClass}
            />
          </div>

          {/* Key Lessons */}
          <div>
            <label className={labelClass}>Key Lessons</label>
            <textarea
              value={form.keyLessons}
              onChange={(e) => handleChange("keyLessons", e.target.value)}
              placeholder="What did you learn?"
              className={textareaClass}
            />
          </div>

          {/* Financial Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Risk Unit ($)</label>
              <input
                type="number"
                value={form.riskUnit}
                onChange={(e) => handleChange("riskUnit", e.target.value)}
                placeholder="250"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Portfolio Start ($)</label>
              <input
                type="number"
                value={form.portfolioStartValue}
                onChange={(e) =>
                  handleChange("portfolioStartValue", e.target.value)
                }
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Portfolio End ($)</label>
              <input
                type="number"
                value={form.portfolioEndValue}
                onChange={(e) =>
                  handleChange("portfolioEndValue", e.target.value)
                }
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#3B82F6]/90 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
