"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { returnPosSaleLines } from "@/actions/pos-returns";
import { Button, Input, Select, Label } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { Search, Package, RotateCcw, Minus, Plus, Check } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

/**
 * Wapsi -- usi counter par, usi tarah.
 *
 * Malik ka usool (5 September): "Product Return ko Sale jitna easy banana
 * hai. Staff ko alag complicated Return page par na bhejein." Aur us ke
 * sath wo baat jo poore feature ki bunyad hai:
 *
 *   "Return ko original invoice se control karna zaroori hai taake koi
 *    staff arbitrary product/quantity/rate return na kar sake."
 *
 * Is liye yahan cheez chunne ka koi raasta nahi hai. Pehle BILL milta
 * hai, phir usi bill ki qatarein saamne aati hain, aur unhi mein se
 * tadaad chuni jati hai. Rate is safhe par likha to jata hai magar bheja
 * nahi jata -- wo asal bill se database khud uthhata hai. Kal cheez ka
 * rate barh jaye to bhi wapsi usi purane rate par hoti hai.
 *
 * "-1 PCS" jaisa kuch yahan nahi dikhta. Ye poora safha hi keh raha hai
 * ke maal wapas aa raha hai; adad ko ulta likh kar wohi baat dobara
 * kehna bande ko uljhata hai.
 */

interface SaleRow {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_mode: string;
  customer_name: string | null;
}

interface ReturnableLine {
  sale_item_id: string;
  product_id: string;
  name: string;
  pack_size: string | null;
  image_url: string | null;
  sold_qty: number;
  returned_qty: number;
  returnable_qty: number;
  original_rate: number;
}

const CONDITIONS = ["saleable", "damaged", "expired", "other"] as const;
type Condition = (typeof CONDITIONS)[number];

export function PosReturn({
  lang,
  recentSales,
  onDone,
}: {
  lang: Lang;
  recentSales: SaleRow[];
  onDone: () => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [sale, setSale] = useState<SaleRow | null>(null);
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cond, setCond] = useState<Record<string, Condition>>({});
  const [reasonCode, setReasonCode] = useState<string>("changed_mind");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");
  const [managerCode, setManagerCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [done, setDone] = useState<{ number: string; amount: number; qty: number } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recentSales.slice(0, 12);
    return recentSales
      .filter(
        (s) =>
          s.id.toLowerCase().startsWith(q) ||
          (s.customer_name ?? "").toLowerCase().includes(q) ||
          String(s.total_amount).includes(q)
      )
      .slice(0, 12);
  }, [recentSales, query]);

  async function openSale(s: SaleRow) {
    setSale(s);
    setLines([]);
    setQty({});
    setCond({});
    setMsg(null);
    setLoading(true);

    // Kitna wapas ho sakta hai -- ye hisaab database ke us khane se aata
    // hai jo bikri aur pichhli wapsiyon dono ko dekhta hai. Yahan dobara
    // ginne se do jagah do jawab ban jate.
    const { data: rows, error } = await supabase
      .from("v_pos_sale_returnable")
      .select("sale_item_id, product_id, sold_qty, returned_qty, returnable_qty, original_rate")
      .eq("sale_id", s.id);

    if (error) {
      setMsg({ type: "error", text: `Bill ki qatarein nahi mil sakin: ${error.message}` });
      setLoading(false);
      return;
    }

    // Cheez ka naam alag sawal se. Embed nakaam ho to wo KHALI lauta
    // deta hai -- aur us soorat mein poori fehrist gayab, yani wapsi
    // rukti nahi, bas cheezein nazar nahi aatin.
    const ids = Array.from(new Set((rows ?? []).map((r) => r.product_id)));
    const { data: prods } = ids.length
      ? await supabase.from("products").select("id, name, pack_size, image_url").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));

    setLines(
      (rows ?? []).map((r: any) => ({
        sale_item_id: r.sale_item_id,
        product_id: r.product_id,
        name: byId.get(r.product_id)?.name ?? "—",
        pack_size: byId.get(r.product_id)?.pack_size ?? null,
        image_url: byId.get(r.product_id)?.image_url ?? null,
        sold_qty: Number(r.sold_qty),
        returned_qty: Number(r.returned_qty),
        returnable_qty: Number(r.returnable_qty),
        original_rate: Number(r.original_rate),
      }))
    );
    setLoading(false);
  }

  function setLineQty(line: ReturnableLine, n: number) {
    // Bechi hui tadaad se zyada yahan likhi hi nahi ja sakti. Rok database
    // par bhi lagi hui hai; ye us ka doosra taala hai, taake banda ghalat
    // adad likh kar aakhir mein na ruke.
    const clamped = Math.max(0, Math.min(n, line.returnable_qty));
    setQty((prev) => ({ ...prev, [line.sale_item_id]: clamped }));
  }

  const cart = lines
    .map((l) => ({ line: l, n: qty[l.sale_item_id] ?? 0 }))
    .filter((x) => x.n > 0);
  const refundTotal = cart.reduce((s, x) => s + x.n * x.line.original_rate, 0);
  const returnQty = cart.reduce((s, x) => s + x.n, 0);

  async function submit() {
    setMsg(null);
    if (!sale) return;
    if (cart.length === 0) {
      setMsg({ type: "error", text: t("ret_pick_items", lang) });
      return;
    }
    if (reason.trim().length < 5) {
      setMsg({ type: "error", text: t("ret_reason_needed", lang) });
      return;
    }
    if (!managerCode.trim()) {
      setMsg({ type: "error", text: t("ret_code_needed", lang) });
      return;
    }

    setSubmitting(true);
    const res = await returnPosSaleLines({
      saleId: sale.id,
      lines: cart.map((x) => ({
        saleItemId: x.line.sale_item_id,
        quantity: x.n,
        condition: cond[x.line.sale_item_id] ?? "saleable",
      })),
      reason: reason.trim(),
      reasonCode: reasonCode,
      refundMethod,
      note: note.trim() || null,
      managerCode: managerCode.trim(),
    });
    setSubmitting(false);

    if (res.error) {
      setMsg({ type: "error", text: res.error });
      return;
    }
    // Wapsi ho gayi magar ledger mein na ja saki -- ye chhupaya nahi
    // jata. Maal wapas aa chuka hai aur paisa ja chuka hai; magar counter
    // par khaRe bande ko maloom hona chahiye taake wo raat ki ginti se
    // pehle theek karwa sake.
    if (res.notice) setMsg({ type: "error", text: res.notice });
    setDone({ number: res.returnNumber ?? "—", amount: refundTotal, qty: returnQty });
    setManagerCode("");
  }

  // ---- Wapsi mukammal ----
  if (done) {
    return (
      <Card className="mx-auto max-w-md space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">
          {t("ret_done", lang)}
        </h2>
        <p className="font-mono text-sm text-surface-600 dark:text-surface-300">{done.number}</p>
        <div className="rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800">
          <p className="flex justify-between">
            <span className="text-surface-500">{t("ret_refund", lang)}</span>
            <span className="font-semibold tabular-nums">Rs {done.amount.toLocaleString()}</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span className="text-surface-500">{t("ret_stock_back", lang)}</span>
            <span className="font-semibold tabular-nums">{done.qty}</span>
          </p>
        </div>
        {msg && msg.type === "error" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{msg.text}</p>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onDone}>
            {t("ret_new_sale", lang)}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setDone(null);
              setSale(null);
              setLines([]);
              setQty({});
              setCond({});
              setReason("");
              setNote("");
              setMsg(null);
            }}
          >
            {t("ret_another", lang)}
          </Button>
        </div>
      </Card>
    );
  }

  // ---- Qadam 1: asal bill dhoondein ----
  if (!sale) {
    return (
      <Card className="mx-auto max-w-2xl space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {t("ret_find_sale", lang)}
          </h2>
          {/* Bill ke baghair wapsi ka koi raasta nahi. Ye rok hi wo cheez
              hai jo tadaad aur rate dono ko sach par rakhti hai. */}
          <p className="mt-0.5 text-xs text-surface-500">{t("ret_find_note", lang)}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ret_search", lang)}
            className="h-11 pl-9"
            autoFocus
          />
        </div>

        <div className="divide-y divide-surface-100 rounded-lg border border-surface-200 dark:divide-surface-800 dark:border-surface-700">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-surface-400">{t("ret_no_sale", lang)}</p>
          ) : (
            matches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSale(s)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-50 dark:hover:bg-surface-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-surface-900 dark:text-surface-100">
                    {s.customer_name ?? t("ret_walkin", lang)}
                  </span>
                  <span className="block text-xs text-surface-500">
                    {new Date(s.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {s.payment_mode}
                    {s.status === "partially_returned" ? ` · ${t("ret_partly", lang)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                  Rs {Number(s.total_amount).toLocaleString()}
                </span>
              </button>
            ))
          )}
        </div>
      </Card>
    );
  }

  // ---- Qadam 2 aur 3: qatarein aur wapsi ka cart ----
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {sale.customer_name ?? t("ret_walkin", lang)}
            </p>
            <p className="text-xs text-surface-500">
              {new Date(sale.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {sale.payment_mode} · Rs {Number(sale.total_amount).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSale(null);
              setLines([]);
              setQty({});
              setMsg(null);
            }}
            className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
          >
            {t("ret_other_sale", lang)}
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-surface-400">…</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l) => {
              const n = qty[l.sale_item_id] ?? 0;
              const khatam = l.returnable_qty <= 0;
              return (
                <div
                  key={l.sale_item_id}
                  className={`rounded-lg border p-3 ${
                    n > 0
                      ? "border-brand-500 bg-brand-50/60 dark:bg-brand-950/20"
                      : "border-surface-200 dark:border-surface-800"
                  } ${khatam ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-100 dark:bg-surface-800">
                      {l.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <Package className="h-4 w-4 text-surface-400" strokeWidth={1.5} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
                        {l.name}
                        {l.pack_size ? <span className="text-surface-400"> {l.pack_size}</span> : null}
                      </p>
                      {/* Rate is bill ka. Aaj cheez kis rate par bik rahi
                          hai, us ka yahan koi kaam nahi. */}
                      <p className="text-xs text-surface-500">
                        {t("ret_sold", lang)}: {l.sold_qty} · {t("ret_rate", lang)}: Rs{" "}
                        {l.original_rate.toLocaleString()}
                        {l.returned_qty > 0 && (
                          <span className="ml-1 text-amber-700">
                            · {t("ret_already", lang)}: {l.returned_qty}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-surface-400">{t("ret_can_return", lang)}</p>
                      <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-200">
                        {l.returnable_qty}
                      </p>
                    </div>
                  </div>

                  {!khatam && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLineQty(l, n - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-surface-600 dark:border-surface-700"
                        aria-label="-"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <Input
                        type="number"
                        min={0}
                        max={l.returnable_qty}
                        value={n}
                        onChange={(e) => setLineQty(l, parseInt(e.target.value) || 0)}
                        className="h-8 w-16 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => setLineQty(l, n + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-surface-600 dark:border-surface-700"
                        aria-label="+"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      {n > 0 && (
                        <>
                          {/* Halat sirf tab poochi jati hai jab kuch wapas
                              aa raha ho. Tooti cheez dukan ke maal mein
                              nahi jati -- wo alag godam mein jati hai. */}
                          <Select
                            value={cond[l.sale_item_id] ?? "saleable"}
                            onChange={(e) =>
                              setCond((p) => ({ ...p, [l.sale_item_id]: e.target.value as Condition }))
                            }
                            className="h-8 w-40 text-xs"
                          >
                            <option value="saleable">{t("ret_c_saleable", lang)}</option>
                            <option value="damaged">{t("ret_c_damaged", lang)}</option>
                            <option value="expired">{t("ret_c_expired", lang)}</option>
                            <option value="other">{t("ret_c_other", lang)}</option>
                          </Select>
                          <span className="ml-auto text-sm font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                            Rs {(n * l.original_rate).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {lines.length === 0 && (
              <p className="py-6 text-center text-sm text-surface-400">{t("ret_no_items", lang)}</p>
            )}
          </div>
        )}
      </Card>

      <Card className="flex h-fit flex-col gap-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-surface-100">
            {t("ret_cart", lang)}
          </h2>
        </div>

        {cart.length === 0 ? (
          <p className="py-4 text-center text-sm text-surface-400">{t("ret_cart_empty", lang)}</p>
        ) : (
          <div className="space-y-1.5">
            {cart.map((x) => (
              <div key={x.line.sale_item_id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-surface-700 dark:text-surface-300">
                  {x.line.name}
                  <span className="text-surface-400">
                    {" "}
                    {x.n} × Rs {x.line.original_rate.toLocaleString()}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  Rs {(x.n * x.line.original_rate).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-surface-100 pt-2 dark:border-surface-800">
          <div className="flex justify-between text-sm">
            <span className="text-surface-500">{t("ret_qty_total", lang)}</span>
            <span className="font-medium tabular-nums">{returnQty}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-display text-sm font-semibold text-surface-900 dark:text-white">
              {t("ret_refund_total", lang)}
            </span>
            <span className="font-display text-xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
              Rs {refundTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <div>
          <Label>{t("ret_reason", lang)}</Label>
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="mt-1">
            <option value="wrong_product">{t("ret_r_wrong", lang)}</option>
            <option value="changed_mind">{t("ret_r_mind", lang)}</option>
            <option value="damaged">{t("ret_r_damaged", lang)}</option>
            <option value="quality_issue">{t("ret_r_quality", lang)}</option>
            <option value="other">{t("ret_r_other", lang)}</option>
          </Select>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("ret_reason_hint", lang)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>{t("ret_refund_how", lang)}</Label>
          {/* "Asal adaigi ke mutabiq" hi default hai: jis tarah paisa aaya
              tha usi tarah wapas jata hai. Sab naqad kar dena us bande ko
              naqad de dena hai jis ne kabhi naqad diya hi nahi tha. */}
          <Select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="mt-1">
            <option value="original">{t("ret_m_original", lang)}</option>
            <option value="cash">{t("ret_m_cash", lang)}</option>
            <option value="khata">{t("ret_m_khata", lang)}</option>
          </Select>
        </div>

        <div>
          <Label>{t("ret_manager_code", lang)}</Label>
          <Input
            type="password"
            value={managerCode}
            onChange={(e) => setManagerCode(e.target.value)}
            placeholder="••••"
            className="mt-1"
          />
          {/* Kaam counter par hota hai, ijazat manager ki hoti hai --
              aur dono ka naam alag alag darj rehta hai. */}
          <p className="mt-1 text-[11px] text-surface-400">{t("ret_code_note", lang)}</p>
        </div>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("ret_note", lang)}
          className="text-sm"
        />

        {msg && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.type === "success" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        <Button onClick={submit} disabled={submitting || cart.length === 0} className="py-3 text-base">
          {submitting ? "…" : t("ret_confirm", lang)}
        </Button>
      </Card>
    </div>
  );
}
