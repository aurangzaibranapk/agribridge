"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { RefreshCw, CheckCircle, Package, Clock } from "lucide-react";
import { previewProductCycle, confirmProductCycle, getShopCycleHistory } from "@/actions/product-cycles";
import type { ProductCycleRow, CycleHistoryRow } from "@/actions/product-cycles";

interface Shop {
  id: string;
  name: string;
  code: string | null;
  business_type: string | null;
}

export function ProductCycleClient({ shops }: { shops: Shop[] }) {
  const [shopId, setShopId] = useState("");
  const [count, setCount] = useState(20);
  const [preview, setPreview] = useState<ProductCycleRow[]>([]);
  const [history, setHistory] = useState<CycleHistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmedBatch, setConfirmedBatch] = useState<number | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isConfirming, startConfirm] = useTransition();
  const [isHistory, startHistory] = useTransition();

  const selectedShop = shops.find((s) => s.id === shopId);

  function handlePreview() {
    if (!shopId) return;
    setMessage(null);
    setConfirmedBatch(null);
    startPreview(async () => {
      const res = await previewProductCycle(shopId, count);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        setPreview([]);
      } else {
        setPreview(res.products);
        if (res.products.length === 0)
          setMessage({ type: "success", text: "Is waqt koi product available nahi (sab 30 din ke andar bheji ja chuki hain)." });
      }
    });
  }

  function handleConfirm() {
    if (!shopId || preview.length === 0) return;
    startConfirm(async () => {
      const res = await confirmProductCycle(shopId, preview.map((p) => p.product_id));
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setConfirmedBatch(res.batchNumber ?? null);
        setMessage({ type: "success", text: `Batch #${res.batchNumber} record ho gayi — ${preview.length} products.` });
        setPreview([]);
      }
    });
  }

  function handleHistory() {
    if (!shopId) return;
    setShowHistory(true);
    startHistory(async () => {
      const res = await getShopCycleHistory(shopId);
      setHistory(res.history);
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  }

  // Group history by batch
  const batches = history.reduce<Record<number, CycleHistoryRow[]>>((acc, row) => {
    (acc[row.batch_number] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-[1fr_360px]">
      {/* Left: Main panel */}
      <div className="space-y-6">
        {/* Controls */}
        <Card className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px_auto]">
            <div>
              <Label>Shop Chunein</Label>
              <select
                value={shopId}
                onChange={(e) => { setShopId(e.target.value); setPreview([]); setMessage(null); setShowHistory(false); }}
                className="mt-1 w-full rounded-input border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
              >
                <option value="">— Shop Select Karein —</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.code ? ` (${s.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Products ki Ginti</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handlePreview} disabled={!shopId || isPreviewing} className="w-full sm:w-auto">
                {isPreviewing ? "Load ho raha hai..." : "Agle Products Dekho"}
              </Button>
            </div>
          </div>

          {selectedShop && (
            <p className="text-xs text-surface-500">
              <span className="font-medium">{selectedShop.name}</span>
              {selectedShop.business_type && <> · {selectedShop.business_type}</>}
              {" · "}Jo products 30 din mein nahi gayi, woh pehle dikhenge.
            </p>
          )}
        </Card>

        {/* Message */}
        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"}`}>
            {message.text}
          </div>
        )}

        {/* Preview table */}
        {preview.length > 0 && (
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
              <div>
                <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">
                  Agle {preview.length} Products — {selectedShop?.name}
                </h2>
                <p className="text-xs text-surface-500">Ye products 30 din tak is shop ke liye dobara nahi aayenge</p>
              </div>
              <Button onClick={handleConfirm} disabled={isConfirming}>
                <CheckCircle className="mr-1.5 h-4 w-4" />
                {isConfirming ? "Save ho raha..." : "Confirm Kar Do"}
              </Button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-4 py-3 font-medium text-surface-500">#</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Product</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Category</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Pack</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">Rate</th>
                  <th className="px-4 py-3 text-right font-medium text-surface-500">Aakhri Baar</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, idx) => (
                  <tr key={p.product_id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-4 py-3 text-surface-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{p.product_name}</td>
                    <td className="px-4 py-3 text-surface-500">{p.category_name ?? "—"}</td>
                    <td className="px-4 py-3 text-surface-500">{p.pack_size ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">Rs {p.selling_price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-surface-400">
                      {p.last_cycled ? formatDate(p.last_cycled) : <span className="text-brand-500">Pehli Dafa</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* History */}
        {shopId && (
          <div>
            <button
              onClick={handleHistory}
              disabled={isHistory}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
            >
              <Clock className="h-4 w-4" />
              {showHistory ? "History Refresh Karein" : "Pichli Batches Dekho"}
            </button>

            {showHistory && Object.keys(batches).length > 0 && (
              <div className="mt-3 space-y-4">
                {Object.entries(batches)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([batchNum, rows]) => (
                    <div key={batchNum} className="overflow-hidden rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
                      <div className="flex items-center gap-2 border-b border-surface-200 bg-surface-50 px-4 py-2 dark:border-surface-800 dark:bg-surface-800">
                        <Package className="h-4 w-4 text-brand-500" />
                        <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                          Batch #{batchNum}
                        </span>
                        <span className="text-xs text-surface-400">{formatDate(rows[0].cycled_at)} · {rows.length} products</span>
                      </div>
                      <div className="divide-y divide-surface-100 dark:divide-surface-800">
                        {rows.map((r) => (
                          <div key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                            <span className="text-surface-700 dark:text-surface-300">{r.products?.name ?? r.product_id}</span>
                            <span className="text-xs text-surface-400">{r.products?.pack_size ?? ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {showHistory && Object.keys(batches).length === 0 && !isHistory && (
              <p className="mt-3 text-sm text-surface-400">Is shop ki koi batch history nahi mili.</p>
            )}
          </div>
        )}
      </div>

      {/* Right: Info card */}
      <Card className="h-fit space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-surface-100">Kaise Kaam Karta Hai</h2>
        </div>
        <ol className="space-y-3 text-sm text-surface-600 dark:text-surface-400">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">1</span>
            <span>Koi bhi shop chunein aur kitne products chahiye enter karein.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">2</span>
            <span><strong>Agle Products Dekho</strong> — system automatically wo products dikhayega jo is shop ko abhi tak nahi gayi ya 30 din se zyada pehle gayi thi.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">3</span>
            <span><strong>Confirm Kar Do</strong> — system mein record ho jaata hai. Ye products agle 30 din tak is shop ke liye dobara nahi aayenge.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">4</span>
            <span>Agla batch? Phir <strong>Agle Products Dekho</strong> dabayein — naye products aayenge.</span>
          </li>
        </ol>
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          Jab sab products 30 din ke andar ja chuki hon to message aayega ke koi nahi hai — 30 din baad sab phir available ho jayenge.
        </div>
      </Card>
    </div>
  );
}
