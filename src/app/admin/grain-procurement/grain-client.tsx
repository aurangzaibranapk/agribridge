"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { createGrainEntry, recordGrainPayment, createGrainParty, type ActionState } from "@/actions/grain-procurement";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { X, Plus, FileText, AlertTriangle, Trash2 } from "lucide-react";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Farmer { id: string; full_name: string; farmer_code: string; }
interface Party { id: string; party_name: string; contact_person: string | null; phone: string | null; }
interface Warehouse { id: string; name: string; }
interface CutPreset { id: string; grain_type: string; label: string; cut_percentage: number; }
interface FinanceAccount { id: string; name: string; account_type: string; }
interface Entry {
  id: string;
  entry_date: string;
  grain_type: string;
  gross_weight_kg: number;
  cut_percentage: number;
  cut_kg: number;
  weight_kg: number;
  moisture_percentage: number | null;
  quality_grade: string | null;
  rate_per_kg: number;
  total_amount: number;
  seller_id: string;
  seller_type: string;
  seller_name: string;
}
interface Payment {
  id: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  seller_id: string;
  seller_type: string;
  seller_name: string;
}
interface Balance {
  seller_id: string;
  seller_type: string;
  seller_name: string;
  total_supplied: number;
  total_paid: number;
  entry_count: number;
  balance_due: number;
}
interface GrainTypeSummary { grain_type: string; totalKg: number; totalValue: number; entryCount: number; }

/**
 * Fasal aur kharche ka naam database mein angrezi mein rehta hai (wo
 * data hai). Yahan sirf lafz ki chaabi rakhi jati hai; asal lafz t()
 * se aata hai.
 */
const GRAIN_LABELS: Record<string, TranslationKey> = { wheat: "gr_wheat", rice: "gr_rice", maize: "gr_maize" };
const EXPENSE_CATEGORIES: { value: string; label: TranslationKey }[] = [
  { value: "diesel_fuel", label: "gr_diesel" },
  { value: "labor_mazdoori", label: "gr_labor" },
  { value: "bardana", label: "gr_bardana" },
  { value: "tractor_trolley_rent", label: "gr_tractor_rent" },
  { value: "other", label: "gr_other" },
];

export function GrainClient({
  farmers,
  parties,
  warehouses,
  cutPresets,
  financeAccounts,
  entries,
  payments,
  balances,
  byGrainType,
}: {
  farmers: Farmer[];
  parties: Party[];
  warehouses: Warehouse[];
  cutPresets: CutPreset[];
  financeAccounts: FinanceAccount[];
  entries: Entry[];
  payments: Payment[];
  balances: Balance[];
  byGrainType: GrainTypeSummary[];
}) {
  const lang = useLang();
  const [tab, setTab] = useState<"entry" | "balances" | "entries">("entry");
  const [payingBalance, setPayingBalance] = useState<Balance | null>(null);
  const [showNewParty, setShowNewParty] = useState(false);

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {byGrainType.map((g) => (
          <div key={g.grain_type} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <p className="text-xs font-medium text-surface-500">{t(GRAIN_LABELS[g.grain_type] ?? "gr_grain", lang)}</p>
            <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{g.totalKg.toLocaleString()} kg</p>
            <p className="text-xs text-surface-400">Rs {g.totalValue.toLocaleString()} - {g.entryCount} entries</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2 border-b border-surface-200 dark:border-surface-800">
        <TabButton active={tab === "entry"} onClick={() => setTab("entry")}>{t("gr_new_entry", lang)}</TabButton>
        <TabButton active={tab === "balances"} onClick={() => setTab("balances")}>{t("gr_balances", lang)}</TabButton>
        <TabButton active={tab === "entries"} onClick={() => setTab("entries")}>{t("gr_full_history", lang)}</TabButton>
      </div>

      {tab === "entry" && (
        <div className="space-y-4">
          <button onClick={() => setShowNewParty(true)} className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
            <Plus className="h-3.5 w-3.5" /> Nayi Party Banayein
          </button>
          <NewEntryForm farmers={farmers} parties={parties} warehouses={warehouses} cutPresets={cutPresets} financeAccounts={financeAccounts} />
        </div>
      )}

      {tab === "balances" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_name", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_type", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_entries", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_total_supply_value", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_total_paid", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_remaining", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_action", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={`${b.seller_type}-${b.seller_id}`} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{b.seller_name}</td>
                  <td className="px-3 py-2 text-xs text-surface-500">{b.seller_type === "farmer" ? "Farmer" : "Party"}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{b.entry_count}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {b.total_supplied.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-green-600">Rs {b.total_paid.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${b.balance_due > 0 ? "text-amber-600" : "text-surface-400"}`}>Rs {b.balance_due.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link href={`/admin/grain-procurement/statement?seller_type=${b.seller_type}&seller_id=${b.seller_id}`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                        <FileText className="h-3 w-3" /> Statement
                      </Link>
                      {b.balance_due > 0 && (
                        <button onClick={() => setPayingBalance(b)} className="text-xs font-medium text-green-600 hover:underline">{t("gr_make_payment", lang)}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {balances.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">{t("gr_no_entries", lang)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "entries" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_date", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_seller", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_grain", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_gross", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_cut", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_net", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_rate", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_total", lang)}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{e.entry_date}</td>
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{e.seller_name}</td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{t(GRAIN_LABELS[e.grain_type] ?? "gr_grain", lang)}</td>
                  <td className="px-3 py-2 text-right text-surface-500">{e.gross_weight_kg} kg</td>
                  <td className="px-3 py-2 text-right text-red-500">-{e.cut_kg.toFixed(1)} kg ({e.cut_percentage}%)</td>
                  <td className="px-3 py-2 text-right font-medium text-surface-800 dark:text-surface-200">{e.weight_kg.toFixed(1)} kg</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {e.rate_per_kg}</td>
                  <td className="px-3 py-2 text-right font-semibold text-surface-900 dark:text-white">Rs {e.total_amount.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/grain-procurement/bill/${e.id}`} className="text-xs font-medium text-brand-600 hover:underline">{t("gr_bill", lang)}</Link>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-surface-400">{t("gr_no_entries_short", lang)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {payingBalance && (
        <PaymentModal balance={payingBalance} financeAccounts={financeAccounts} onClose={() => setPayingBalance(null)} />
      )}
      {showNewParty && <NewPartyModal onClose={() => setShowNewParty(false)} />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-surface-500 hover:text-surface-700"}`}
    >
      {children}
    </button>
  );
}

function NewEntryForm({
  farmers,
  parties,
  warehouses,
  cutPresets,
  financeAccounts,
}: {
  farmers: Farmer[];
  parties: Party[];
  warehouses: Warehouse[];
  cutPresets: CutPreset[];
  financeAccounts: FinanceAccount[];
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(createGrainEntry, initialState);
  const [sellerType, setSellerType] = useState<"farmer" | "party">("farmer");
  const [grainType, setGrainType] = useState("wheat");
  const [grossWeight, setGrossWeight] = useState("");
  const [grossMaund, setGrossMaund] = useState("");
  const [cutMode, setCutMode] = useState<"preset" | "manual">("preset");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [manualCut, setManualCut] = useState("0");
  const [rate, setRate] = useState("");

  function handleKgChange(value: string) {
    setGrossWeight(value);
    const kg = parseFloat(value);
    setGrossMaund(kg ? (kg / 40).toFixed(2) : "");
  }
  function handleMaundChange(value: string) {
    setGrossMaund(value);
    const maund = parseFloat(value);
    setGrossWeight(maund ? (maund * 40).toFixed(2) : "");
  }

  const [hasExpense, setHasExpense] = useState<"" | "yes" | "no">("");
  const [expenseRows, setExpenseRows] = useState<{ category: string; description: string; amount: string; account_id: string }[]>([
    { category: "diesel_fuel", description: "", amount: "", account_id: "" },
  ]);

  const [chungiType, setChungiType] = useState<"cash" | "grain">("cash");
  const [chungiCash, setChungiCash] = useState("0");
  const [chungiKg, setChungiKg] = useState("0");

  const [makePayment, setMakePayment] = useState<"" | "yes" | "no">("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const relevantPresets = useMemo(() => cutPresets.filter((p) => p.grain_type === grainType), [cutPresets, grainType]);
  const selectedPreset = relevantPresets.find((p) => p.id === selectedPresetId);
  const effectiveCutPercentage = cutMode === "preset" ? (selectedPreset?.cut_percentage ?? 0) : parseFloat(manualCut) || 0;

  const gross = parseFloat(grossWeight) || 0;
  const cutKg = gross * (effectiveCutPercentage / 100);
  const netWeight = gross - cutKg;
  const rateNum = parseFloat(rate) || 0;
  const total = netWeight * rateNum;
  const chungiAmount = chungiType === "grain" ? (parseFloat(chungiKg) || 0) * rateNum : parseFloat(chungiCash) || 0;
  const payableToSeller = total - chungiAmount;

  const expensesJson = JSON.stringify(
    expenseRows
      .filter((r) => r.amount && Number(r.amount) > 0)
      .map((r) => ({ category: r.category, description: r.description, amount: Number(r.amount), account_id: r.account_id }))
  );

  function addExpenseRow() {
    setExpenseRows((prev) => [...prev, { category: "diesel_fuel", description: "", amount: "", account_id: "" }]);
  }
  function removeExpenseRow(idx: number) {
    setExpenseRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateExpenseRow(idx: number, field: string, value: string) {
    setExpenseRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  if (state.success) {
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("gr_new_grain_entry", lang)}</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          Entry record ho gayi, stock add ho gaya.{" "}
          {state.paymentId ? (
            <Link href={`/admin/grain-procurement/payment-slip/${state.paymentId}`} className="underline">{t("gr_view_payment_slip", lang)}</Link>
          ) : (
            <Link href={`/admin/grain-procurement/bill/${state.entryId}`} className="underline">{t("gr_view_entry_slip", lang)}</Link>
          )}
        </p>
      )}
      <form action={formAction} encType="multipart/form-data" className="space-y-3">
        <input type="hidden" name="seller_type" value={sellerType} />
        <input type="hidden" name="cut_percentage" value={effectiveCutPercentage} />
        <input type="hidden" name="has_expense" value={hasExpense} />
        <input type="hidden" name="expenses_json" value={expensesJson} />
        <input type="hidden" name="chungi_type" value={chungiType} />
        <input type="hidden" name="chungi_kg" value={chungiKg} />
        <input type="hidden" name="chungi_amount" value={chungiCash} />
        <input type="hidden" name="make_payment" value={makePayment} />

        <div>
          <Label>{t("gr_who_brought", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setSellerType("farmer")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${sellerType === "farmer" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_farmer", lang)}</button>
            <button type="button" onClick={() => setSellerType("party")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${sellerType === "party" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_party", lang)}</button>
          </div>
        </div>
        {sellerType === "farmer" ? (
          <div>
            <Label>{t("gr_farmer_req", lang)}</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <Label>{t("gr_party_req", lang)}</Label>
            <Select name="party_id" required>
              <option value="">- select -</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.party_name}{p.contact_person ? ` - ${p.contact_person}` : ""}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label>{t("gr_grain_type_req", lang)}</Label>
          <Select name="grain_type" value={grainType} onChange={(e) => { setGrainType(e.target.value); setSelectedPresetId(""); }}>
            <option value="wheat">Wheat (Gandum)</option>
            <option value="rice">Rice (Chawal)</option>
            <option value="maize">Maize (Makai)</option>
          </Select>
        </div>
        <div>
          <Label>{t("gr_date", lang)}</Label>
          <Input type="date" name="entry_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("gr_gross_kg_req", lang)}</Label>
            <Input type="number" step="0.1" name="gross_weight_kg" value={grossWeight} onChange={(e) => handleKgChange(e.target.value)} required />
          </div>
          <div>
            <Label>{t("gr_gross_maund", lang)}</Label>
            <Input type="number" step="0.01" value={grossMaund} onChange={(e) => handleMaundChange(e.target.value)} placeholder={t("gr_auto", lang)} />
          </div>
        </div>
        <div>
          <Label>{t("gr_rate_per_kg_req", lang)}</Label>
          <Input type="number" step="0.01" name="rate_per_kg" value={rate} onChange={(e) => setRate(e.target.value)} required />
        </div>

        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <Label>{t("gr_cut_deduction", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setCutMode("preset")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${cutMode === "preset" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_from_preset", lang)}</button>
            <button type="button" onClick={() => setCutMode("manual")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${cutMode === "manual" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_write_manually", lang)}</button>
          </div>
          {cutMode === "preset" ? (
            <select value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)} className="mt-2 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- Cut Preset Select Karein (ya 0% ke liye khaali chhodein) -</option>
              {relevantPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label} - {p.cut_percentage}%</option>
              ))}
            </select>
          ) : (
            <Input type="number" step="0.01" placeholder={t("gr_cut_pc_ph", lang)} value={manualCut} onChange={(e) => setManualCut(e.target.value)} className="mt-2" />
          )}
          <div className="mt-2 space-y-0.5 text-xs">
            <div className="flex justify-between text-surface-500"><span>{t("gr_cut", lang)}</span><span>{cutKg.toFixed(2)} kg ({effectiveCutPercentage}%)</span></div>
            <div className="flex justify-between font-semibold text-surface-700 dark:text-surface-300"><span>{t("gr_net_weight", lang)}</span><span>{netWeight.toFixed(2)} kg</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <Label>{t("gr_chungi", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setChungiType("cash")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${chungiType === "cash" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_cash_rs", lang)}</button>
            <button type="button" onClick={() => setChungiType("grain")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${chungiType === "grain" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_grain_kg", lang)}</button>
          </div>
          {chungiType === "cash" ? (
            <Input type="number" step="0.01" value={chungiCash} onChange={(e) => setChungiCash(e.target.value)} placeholder={t("gr_rs_amount", lang)} className="mt-2" />
          ) : (
            <div className="mt-2">
              <Input type="number" step="0.01" value={chungiKg} onChange={(e) => setChungiKg(e.target.value)} placeholder={t("gr_how_many_kg", lang)} />
              <p className="mt-1 text-[11px] text-surface-400">Rate se khud calculate hoga: {(parseFloat(chungiKg) || 0)} kg x Rs {rateNum} = Rs {chungiAmount.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("gr_moisture", lang)}</Label>
            <Input type="number" step="0.01" name="moisture_percentage" />
          </div>
          <div>
            <Label>{t("gr_quality_grade", lang)}</Label>
            <Input name="quality_grade" placeholder={t("gr_grade_eg", lang)} />
          </div>
        </div>
        <div>
          <Label>{t("gr_warehouse_req", lang)}</Label>
          <Select name="warehouse_id" required>
            <option value="">- select -</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("gr_notes", lang)}</Label>
          <Textarea name="notes" rows={2} />
        </div>

        <div className={`rounded-lg border-2 p-3 ${hasExpense === "" ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20" : "border-surface-200 dark:border-surface-700"}`}>
          <Label>{t("gr_any_expense", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setHasExpense("yes")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${hasExpense === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_yes", lang)}</button>
            <button type="button" onClick={() => setHasExpense("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${hasExpense === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_no", lang)}</button>
          </div>
          {hasExpense === "" && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Jab tak confirm nahi karenge, Entry save nahi hogi.
            </p>
          )}
          {hasExpense === "yes" && (
            <div className="mt-3 space-y-2">
              {expenseRows.map((row, idx) => (
                <div key={idx} className="rounded-lg border border-surface-200 p-2 dark:border-surface-700">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-surface-400">Expense {idx + 1}</span>
                    {expenseRows.length > 1 && (
                      <button type="button" onClick={() => removeExpenseRow(idx)} className="text-surface-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={row.category} onChange={(e) => updateExpenseRow(idx, "category", e.target.value)} className="rounded-lg border border-surface-200 p-1.5 text-xs">
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{t(c.label, lang)}</option>
                      ))}
                    </select>
                    <input placeholder={t("gr_amount_rs", lang)} type="number" step="0.01" value={row.amount} onChange={(e) => updateExpenseRow(idx, "amount", e.target.value)} className="rounded-lg border border-surface-200 p-1.5 text-xs" />
                    <input placeholder={t("gr_description", lang)} value={row.description} onChange={(e) => updateExpenseRow(idx, "description", e.target.value)} className="col-span-2 rounded-lg border border-surface-200 p-1.5 text-xs" />
                    <select value={row.account_id} onChange={(e) => updateExpenseRow(idx, "account_id", e.target.value)} className="col-span-2 rounded-lg border border-surface-200 p-1.5 text-xs">
                      <option value="">- Konsa Account Se Paisa Gaya -</option>
                      {financeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addExpenseRow} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Aur Expense Add Karein
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-surface-700 dark:text-surface-300">{t("gr_grain_value", lang)}</span>
            <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">Rs {total.toLocaleString()}</span>
          </div>
          {chungiAmount > 0 && (
            <div className="mt-1 flex items-center justify-between text-xs text-red-600">
              <span>Chungi Katoti ({chungiType === "grain" ? `${chungiKg} kg` : "Cash"})</span><span>- Rs {chungiAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-surface-200 pt-1 text-sm font-semibold text-surface-800 dark:border-surface-700 dark:text-surface-200">
            <span>{t("gr_payable", lang)}</span><span>Rs {payableToSeller.toLocaleString()}</span>
          </div>
        </div>

        <div className={`rounded-lg border-2 p-3 ${makePayment === "" ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20" : "border-surface-200 dark:border-surface-700"}`}>
          <Label>{t("gr_pay_now", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => { setMakePayment("yes"); setPaymentAmount(payableToSeller.toFixed(2)); }} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${makePayment === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_yes", lang)}</button>
            <button type="button" onClick={() => setMakePayment("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${makePayment === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_no", lang)}</button>
          </div>
          {makePayment === "" && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Jab tak confirm nahi karenge, Entry save nahi hogi.
            </p>
          )}
          {makePayment === "yes" && (
            <div className="mt-3 space-y-2">
              <div>
                <Label>{t("gr_amount_cap", lang)}</Label>
                <Input type="number" step="0.01" name="payment_amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} max={payableToSeller} required />
              </div>
              <div>
                <Label>{t("gr_payment_method", lang)}</Label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} name="payment_method" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
                  <option value="cash">{t("gr_cash", lang)}</option>
                  <option value="bank_transfer">{t("gr_bank_transfer", lang)}</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>
              <div>
                <Label>{t("gr_which_account_req", lang)}</Label>
                <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} name="payment_account_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
                  <option value="">- select -</option>
                  {financeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              {paymentMethod === "cash" && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <Label>{t("gr_receiving_photo_req", lang)}</Label>
                  <input type="file" name="receipt_photo" accept="image/*" required className="mt-1 w-full text-xs" />
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">{t("gr_receiving_note_short", lang)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <SubmitButton label={t("gr_record_entry", lang)} disabled={hasExpense === "" || makePayment === ""} />
      </form>
    </div>
  );
}

function PaymentModal({ balance, financeAccounts, onClose }: { balance: Balance; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordGrainPayment, initialState);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("gr_make_payment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-surface-500">{balance.seller_name} - Baaqi: Rs {balance.balance_due.toLocaleString()}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && (
          <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Payment record ho gayi. <Link href={`/admin/grain-procurement/payment-slip/${state.entryId}`} className="underline">{t("gr_view_slip", lang)}</Link>
          </p>
        )}
        <form action={formAction} encType="multipart/form-data" className="space-y-3">
          <input type="hidden" name="seller_type" value={balance.seller_type} />
          <input type="hidden" name={balance.seller_type === "farmer" ? "farmer_id" : "party_id"} value={balance.seller_id} />
          <div>
            <Label>{t("gr_amount_req", lang)}</Label>
            <Input type="number" step="0.01" name="amount" max={balance.balance_due} defaultValue={balance.balance_due} required />
          </div>
          <div>
            <Label>{t("gr_payment_method", lang)}</Label>
            <Select name="payment_method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">{t("gr_cash", lang)}</option>
              <option value="bank_transfer">{t("gr_bank_transfer", lang)}</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
            </Select>
          </div>
          <div>
            <Label>{t("gr_which_account_from_req", lang)}</Label>
            <Select name="account_id" required>
              <option value="">- select -</option>
              {financeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          {paymentMethod === "cash" && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
              <Label>{t("gr_receiving_photo_req", lang)}</Label>
              <input type="file" name="receipt_photo" accept="image/*" required className="mt-1 w-full text-xs" />
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">{t("gr_receiving_note", lang)}</p>
            </div>
          )}
          <div>
            <Label>{t("gr_notes", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>
          {balance.seller_type === "farmer" && (
            <p className="text-[11px] text-surface-400">{t("gr_credit_note", lang)}</p>
          )}
          <SubmitButton label={t("gr_record_payment", lang)} />
        </form>
      </div>
    </div>
  );
}

function NewPartyModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(createGrainParty, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("gr_new_party", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("gr_party_created", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <Input name="party_name" required placeholder={t("gr_party_name_req", lang)} />
          <Input name="contact_person" placeholder={t("gr_contact_person", lang)} />
          <Input name="phone" placeholder={t("gr_phone", lang)} />
          <Input name="cnic" placeholder={t("gr_cnic_optional", lang)} />
          <Textarea name="address" rows={2} placeholder={t("gr_address", lang)} />
          <SubmitButton label={t("gr_create_party", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending || disabled} className="w-full">{pending ? t("gr_saving", lang) : label}</Button>;
}