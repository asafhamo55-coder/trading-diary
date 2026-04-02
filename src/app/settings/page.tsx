"use client";

import { useState } from "react";
import { Settings, Save, Plus, X } from "lucide-react";
import { DEMO_ACCOUNT } from "@/lib/demo-data";

interface AssetLeverageEntry {
  id: string;
  symbol: string;
  leverage: number;
}

const INITIAL_LEVERAGES: AssetLeverageEntry[] = [
  { id: "al1", symbol: "TQQQ", leverage: 3 },
  { id: "al2", symbol: "SOXL", leverage: 3 },
  { id: "al3", symbol: "UPRO", leverage: 3 },
  { id: "al4", symbol: "LABU", leverage: 3 },
];

export default function SettingsPage() {
  const [calendarYear, setCalendarYear] = useState(
    DEMO_ACCOUNT.calendarYear.toString()
  );
  const [startingBalance, setStartingBalance] = useState(
    DEMO_ACCOUNT.startingBalance.toString()
  );
  const [accountOpenBalance, setAccountOpenBalance] = useState(
    DEMO_ACCOUNT.accountOpenBalance.toString()
  );
  const [commissionPerShare, setCommissionPerShare] = useState(
    DEMO_ACCOUNT.commissionPerShare.toString()
  );
  const [minimumCommission, setMinimumCommission] = useState(
    DEMO_ACCOUNT.minimumCommission.toString()
  );

  const [leverages, setLeverages] =
    useState<AssetLeverageEntry[]>(INITIAL_LEVERAGES);
  const [newSymbol, setNewSymbol] = useState("");
  const [newLeverage, setNewLeverage] = useState("");

  function handleAddLeverage() {
    const symbol = newSymbol.trim().toUpperCase();
    const leverage = parseFloat(newLeverage);
    if (!symbol || isNaN(leverage) || leverage <= 0) return;
    setLeverages((prev) => [
      ...prev,
      { id: `al-${Date.now()}`, symbol, leverage },
    ]);
    setNewSymbol("");
    setNewLeverage("");
  }

  function handleRemoveLeverage(id: string) {
    setLeverages((prev) => prev.filter((l) => l.id !== id));
  }

  function handleSave() {
    alert("Settings saved (demo).");
  }

  const inputClass =
    "w-full bg-[#1C2130] border border-[#2A3040] rounded-lg px-3 py-2 text-sm text-[#E8ECF4] placeholder-[#8892A6] focus:outline-none focus:border-[#3B82F6] transition-colors";
  const labelClass = "block text-sm font-medium text-[#8892A6] mb-1";

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#E8ECF4]">Settings</h1>
        <p className="text-[#8892A6] text-sm mt-1">
          Account configuration and preferences
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Account Settings */}
        <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-lg font-semibold text-[#E8ECF4]">
              Account Settings
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Calendar Year</label>
              <input
                type="number"
                value={calendarYear}
                onChange={(e) => setCalendarYear(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Starting Balance ($)</label>
              <input
                type="number"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Account Open Balance ($)</label>
              <input
                type="number"
                value={accountOpenBalance}
                onChange={(e) => setAccountOpenBalance(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Commission Rate (IBKR)</label>
              <input
                type="number"
                step="0.001"
                value={commissionPerShare}
                onChange={(e) => setCommissionPerShare(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Minimum Commission ($)</label>
              <input
                type="number"
                step="0.01"
                value={minimumCommission}
                onChange={(e) => setMinimumCommission(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Asset Leverages */}
        <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
          <h2 className="text-lg font-semibold text-[#E8ECF4] mb-4">
            Asset Leverages
          </h2>
          <p className="text-sm text-[#8892A6] mb-4">
            Configure leverage multipliers for leveraged ETFs and other
            instruments.
          </p>

          {/* Add form */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="Symbol"
              className={`${inputClass} max-w-[160px]`}
            />
            <input
              type="number"
              value={newLeverage}
              onChange={(e) => setNewLeverage(e.target.value)}
              placeholder="Leverage"
              step="0.5"
              className={`${inputClass} max-w-[120px]`}
            />
            <button
              onClick={handleAddLeverage}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#3B82F6]/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Table */}
          {leverages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A3040]">
                    <th className="text-left py-2 text-[#8892A6] font-medium">
                      Symbol
                    </th>
                    <th className="text-right py-2 text-[#8892A6] font-medium">
                      Leverage
                    </th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {leverages.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[#2A3040]/50"
                    >
                      <td className="py-2 font-medium text-[#E8ECF4]">
                        {l.symbol}
                      </td>
                      <td className="py-2 text-right text-[#E8ECF4]">
                        {l.leverage}x
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRemoveLeverage(l.id)}
                          className="p-1 rounded text-[#8892A6] hover:text-[#FF4D6A] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#8892A6]">No leverages configured.</p>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#3B82F6]/90 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
