"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { ClipboardCheck, CheckCircle, AlertCircle, Settings } from "lucide-react";
import {
  getCycleCountSettings,
  saveCycleCountSettings,
  getTodaySession,
  startTodaySession,
  getSessionItems,
  saveCountedQty,
  submitSession,
  getCycleCountHistory,
} from "@/actions/cycle-stock-count";
import type { CycleCountItemResult } from "@/actions/cycle-stock-count";

export function StockCountCycleClient({
  initialSettings,
  initialSession,
  initialItems,
}: {
  initialSettings: { cycle_days: number; daily_count: number };
  initialSession: { id: string; status: string; submitted_at: string | null } | null;
  initialItems: CycleCountItemResult[];
}) {
  const [cycleDays, setCycleDays] = useState(initialSettings.cycle_days);
  const [dailyCount, setDailyCount] = useState(initialSettings.daily_count);
  const [session, setSession] = useState(initialSession);
  const [items, setItems] = useState<CycleCountItemResult[]>(initialItems);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; session_date: string; submitted_at: string; cycle_count_items: { id: string }[] }>>([]);
  const [isPending, start] = useTransition();

  function handleSaveSettings() {
    start(async () => {
      const res = await saveCycleCountSettings(cycleDays, dailyCount);
      if (res.error) setMessage({ type: "error", text: res.error });
      else { setMessage({ type: "success", text: "Settings save ho gayi." }); setShowSettings(false); }
    });
  }

  function handleStartSession() {
    setMessage(null);
    start(async () => {
      const res = await startTodaySession(cycleDays, dailyCount);
      if (res.error === "CYCLE_COMPLETE") {
        setMessage({ type: "success", text: `Cycle complete ho gayi! ${cycleDays} din mein sab products count ho gaye. Agli cycle abhi shuru hogi.` });
        return;
      }
      if (res.error) { setMessage({ type: "error", text: res.error }); return; }
      // Refresh session + items
      const [newSession, newItems] = await Promise.all([
        getTodaySession(),
        res.sessionId ? getSessionItems(res.sessionId) : Promise.resolve([]),
      ]);
      setSession(newSession);
      setItems(newItems);
    });
  }

  function handleCountChange(itemId: string, val: string) {
    setCounts((prev) => ({ ...prev, [itemId]: val }));
  }

  function handleSaveCount(itemId: string) {
    const val = parseFloat(counts[itemId] ?? "");
    if (isNaN(val) || val < 0) return;
    start(async () => {
      await saveCountedQty(itemId, val);
      // Update local state
      setItems((prev) => prev.map((i) => i.id === itemId ? {
        ...i,
        counted_qty: val,
        difference_qty: val - (i.system_qty ?? 0),
        difference_value: (val - (i.system_qty ?? 0)) * (i.sale_rate ?? 0),
      } : i));
    });
  }

  function handleSubmit() {
    if (!session) return;
    start(async () => {
      const res = await submitSession(session.id);
      if (res.error) { setMessage({ type: "error", text: res.error }); return; }
      setSession({ ...session, status: "submitted", submitted_at: new Date().toISOString() });
      setMessage({ type: "success", text: "Aaj ki counting submit ho gayi!" });
    });
  }

  function handleLoadHistory() {
    start(async () => {
      const h = await getCycleCountHistory(10);
      setHistory(h);
    });
  }

  const totalDiff = items.reduce((s, i) => s + (i.difference_value ?? 0), 0);
  const totalVariance = items.filter((i) => i.counted_qty !== null && i.counted_qty !== i.system_qty).length;
  const allCounted = items.length > 0 && items.every((i) => i.counted_qty !== null);
  const submitted = session?.status === "submitted";

  return (
    <div className="space-y-6 p-4">
      {/* Settings toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700"
        >
          <Settings className="h-4 w-4" />
          Settings: {cycleDays} din · Roz {dailyCount} products
        </button>
      </div>

      {showSettings && (
        <Card className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Cycle (din)</Label>
            <select
              value={cycleDays}
              onChange={(e) => setCycleDays(parseInt(e.target.value))}
              className="mt-1 rounded-input border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-white"
            >
              <option value={15}>15 din</option>
              <option value={30}>30 din</option>
              <option value={7}>7 din</option>
            </select>
          </div>
          <div>
            <Label>Roz kitne products</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={dailyCount}
              onChange={(e) => setDailyCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-28"
            />
          </div>
          <Button onClick={handleSaveSettings} disabled={isPending}>Save</Button>
        </Card>
      )}

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"}`}>
          {message.text}
        </div>
      )}

      {/* No session today */}
      {!session && (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <ClipboardCheck className="h-10 w-10 text-surface-300" />
          <div>
            <p className="font-display text-sm font-semibold text-surface-800 dark:text-surface-200">Aaj ki counting shuru nahi hui</p>
            <p className="mt-1 text-xs text-surface-500">System {dailyCount} products assign karega jo {cycleDays} din mein count nahi hue.</p>
          </div>
          <Button onClick={handleStartSession} disabled={isPending}>
            {isPending ? "Load ho raha..." : "Aaj ki Counting Shuru Karein"}
          </Button>
        </Card>
      )}

      {/* Session open: counting sheet */}
      {session && !submitted && items.length > 0 && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <div>
              <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">
                Aaj ke {items.length} Products — Asli Ginti Darj Karein
              </h2>
              <p className="text-xs text-surface-500">Sale rate ke saath farq dikhega</p>
            </div>
            {allCounted && (
              <Button onClick={handleSubmit} disabled={isPending}>
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Submit Karein
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-4 py-3 font-medium text-surface-500">#</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Product</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">System Qty</th>
                  <th className="px-4 py-3 text-center font-medium text-surface-500">Asli Ginti</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">Farq (Qty)</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">Farq (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const inputVal = counts[item.id] ?? (item.counted_qty !== null ? String(item.counted_qty) : "");
                  const diffQty = item.counted_qty !== null ? item.difference_qty : null;
                  const diffVal = item.counted_qty !== null ? item.difference_value : null;
                  return (
                    <tr key={item.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-4 py-3 text-surface-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-surface-800 dark:text-surface-200">{item.product_name}</p>
                        <p className="text-xs text-surface-400">{item.category_name ?? ""}{item.pack_size ? ` · ${item.pack_size}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-surface-600">{item.system_qty}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            value={inputVal}
                            onChange={(e) => handleCountChange(item.id, e.target.value)}
                            className="w-24 text-center"
                            placeholder="0"
                          />
                          {inputVal !== "" && inputVal !== String(item.counted_qty) && (
                            <button
                              onClick={() => handleSaveCount(item.id)}
                              className="rounded bg-brand-100 px-1.5 py-1 text-xs text-brand-700 hover:bg-brand-200 dark:bg-brand-950 dark:text-brand-300"
                            >
                              Save
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${diffQty === null ? "text-surface-300" : diffQty === 0 ? "text-brand-600" : diffQty > 0 ? "text-brand-600" : "text-red-600"}`}>
                        {diffQty === null ? "—" : diffQty > 0 ? `+${diffQty}` : diffQty}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${diffVal === null ? "text-surface-300" : diffVal === 0 ? "text-brand-600" : diffVal > 0 ? "text-brand-600" : "text-red-600"}`}>
                        {diffVal === null ? "—" : `${diffVal > 0 ? "+" : ""}Rs ${Math.round(Math.abs(diffVal)).toLocaleString()}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submitted session: final statement */}
      {session && submitted && items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
            <CheckCircle className="h-4 w-4" />
            Aaj ki counting submit ho gayi — {items.length} products.
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card className="text-center">
              <p className="text-xs text-surface-500">Total Products</p>
              <p className="mt-1 font-display text-2xl font-bold text-surface-900 dark:text-white">{items.length}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-surface-500">Farq wale Products</p>
              <p className={`mt-1 font-display text-2xl font-bold ${totalVariance > 0 ? "text-red-600" : "text-brand-600"}`}>{totalVariance}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-surface-500">Total Farq (Rs)</p>
              <p className={`mt-1 font-display text-xl font-bold ${totalDiff < 0 ? "text-red-600" : totalDiff > 0 ? "text-brand-600" : "text-surface-500"}`}>
                {totalDiff > 0 ? "+" : ""}Rs {Math.round(Math.abs(totalDiff)).toLocaleString()}
              </p>
            </Card>
          </div>

          {/* Detail table */}
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
              <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">Farq ki Statement</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-4 py-3 text-left font-medium text-surface-500">Product</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">System</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">Asli</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">Farq (Qty)</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">Sale Rate</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">Farq (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${item.difference_qty !== 0 ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-surface-800 dark:text-surface-200">{item.product_name}</p>
                        <p className="text-xs text-surface-400">{item.category_name ?? ""}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-surface-600">{item.system_qty}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{item.counted_qty ?? "—"}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${item.difference_qty > 0 ? "text-brand-600" : item.difference_qty < 0 ? "text-red-600" : "text-surface-400"}`}>
                        {item.difference_qty > 0 ? `+${item.difference_qty}` : item.difference_qty}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-surface-500">Rs {item.sale_rate?.toLocaleString()}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${item.difference_value > 0 ? "text-brand-600" : item.difference_value < 0 ? "text-red-600" : "text-surface-400"}`}>
                        {item.difference_value !== 0 ? `${item.difference_value > 0 ? "+" : ""}Rs ${Math.round(Math.abs(item.difference_value)).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-surface-300 dark:border-surface-700">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-surface-700 dark:text-surface-300">Kul Farq:</td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${totalDiff < 0 ? "text-red-600" : totalDiff > 0 ? "text-brand-600" : "text-surface-500"}`}>
                      {totalDiff !== 0 ? `${totalDiff > 0 ? "+" : ""}Rs ${Math.round(Math.abs(totalDiff)).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {totalVariance === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
              <CheckCircle className="h-4 w-4" />
              Koi farq nahi! Sab stock bilkul theek hai.
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length === 0 && (
        <button onClick={handleLoadHistory} className="text-sm text-brand-600 hover:text-brand-700">
          Pichli sessions dekho
        </button>
      )}
      {history.length > 0 && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Pichli Sessions</h2>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-surface-700 dark:text-surface-300">
                  {new Date(h.session_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <span className="text-surface-500">{h.cycle_count_items?.length ?? 0} products</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
