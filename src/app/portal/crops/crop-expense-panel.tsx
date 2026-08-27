"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addCropExpenseAction, bookHarvestAction, type ExpenseState } from "./actions";
import { Plus, X, Wheat, CheckCircle2 } from "lucide-react";

const initialState: ExpenseState = {};

const CATEGORIES = [
  { value: "land_prep", label: "Zameen Tayari" },
  { value: "seed", label: "Beej" },
  { value: "water", label: "Pani" },
  { value: "fertilizer", label: "Khaad" },
  { value: "spray", label: "Spray/Pesticide" },
  { value: "labor", label: "Mazdori" },
  { value: "other", label: "Doosra" },
];

interface RateOption {
  id: string;
  name: string;
  rate: number;
}

interface ExpenseOptions {
  landPrep: RateOption[];
  labor: RateOption[];
  fertilizer: RateOption[];
  pesticide: RateOption[];
  seed: RateOption[];
}

interface Expense {
  id: string;
  expense_category: string;
  source: string;
  description: string | null;
  amount: number;
}

export function CropExpensePanel({
  cropHistoryId,
  expenses,
  areaSownAcres,
  isReadyToHarvest,
  isBooked,
  expenseOptions,
}: {
  cropHistoryId: string;
  expenses: Expense[];
  areaSownAcres: number | null;
  isReadyToHarvest: boolean;
  isBooked: boolean;
  expenseOptions?: ExpenseOptions;
}) {
  const [showForm, setShowForm] = useState(false);

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const perAcre = areaSownAcres && areaSownAcres > 0 ? totalExpense / areaSownAcres : null;

  function categoryLabel(value: string) {
    return CATEGORIES.find((c) => c.value === value)?.label ?? value;
  }

  return (
    <div className="mt-3 border-t border-surface-100 pt-3">
      {isReadyToHarvest && !isBooked && (
        <div className="mb-3 rounded-lg bg-brand-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-800">
            <Wheat className="h-4 w-4" /> Aapki fasal tayyar hai!
          </p>
          <BookHarvestButton cropHistoryId={cropHistoryId} />
        </div>
      )}
      {isBooked && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Harvest Book Ho Chuki Hai - Harvest page par record karein.
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-surface-500">Total Kharcha: Rs {totalExpense.toLocaleString()}</p>
        {perAcre !== null && (
          <p className="text-xs font-medium text-surface-500">Per Acre: Rs {perAcre.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="mt-2 space-y-1">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs text-surface-600">
              <span>
                {categoryLabel(e.expense_category)} {e.source === "internal" ? "(Hamare System Se)" : ""}
                {e.description ? ` - ${e.description}` : ""}
              </span>
              <span className="font-medium">Rs {e.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
      >
        <Plus className="h-3 w-3" /> Kharcha Add Karein
      </button>

      {showForm && (
        <ExpenseModal
          cropHistoryId={cropHistoryId}
          areaSownAcres={areaSownAcres}
          expenseOptions={expenseOptions}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function ExpenseModal({
  cropHistoryId,
  areaSownAcres,
  expenseOptions,
  onClose,
}: {
  cropHistoryId: string;
  areaSownAcres: number | null;
  expenseOptions?: ExpenseOptions;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(addCropExpenseAction, initialState);
  const [source, setSource] = useState<"internal" | "external">("external");
  const [category, setCategory] = useState("land_prep");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState("");

  if (state.success) {
    setTimeout(onClose, 800);
  }

  // Which rate-list applies for the currently selected category - Land
  // Prep and Labor come from admin-set master rates; Fertilizer/
  // Pesticide/Seed come from actual Products so the price is always
  // current.
  const optionsForCategory: RateOption[] =
    category === "land_prep" ? expenseOptions?.landPrep ?? []
    : category === "labor" ? expenseOptions?.labor ?? []
    : category === "fertilizer" ? expenseOptions?.fertilizer ?? []
    : category === "spray" ? expenseOptions?.pesticide ?? []
    : category === "seed" ? expenseOptions?.seed ?? []
    : [];

  const showDropdown = optionsForCategory.length > 0;

  function handleOptionSelect(optionId: string) {
    const option = optionsForCategory.find((o) => o.id === optionId);
    if (!option) return;
    setDescription(option.name);
    if (category === "land_prep" && areaSownAcres) {
      setAmount(String(Math.round(option.rate * areaSownAcres)));
    } else {
      setAmount(String(option.rate));
    }
    if (["fertilizer", "spray", "seed"].includes(category)) {
      setProductId(optionId);
      setSource("internal");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Kharcha Add Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Add ho gaya.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="crop_history_id" value={cropHistoryId} />
          <input type="hidden" name="product_id" value={productId} />

          <div>
            <label className="text-xs font-medium text-surface-600">Category</label>
            <select
              name="expense_category"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setAmount(""); setDescription(""); setProductId(""); }}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {showDropdown && (
            <div>
              <label className="text-xs font-medium text-surface-600">
                {category === "land_prep" ? "Kaam Ka Type" : category === "labor" ? "Mazdori Ka Type" : "Product Select Karein"}
              </label>
              <select onChange={(e) => handleOptionSelect(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">- select karein -</option>
                {optionsForCategory.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} (Rs {o.rate.toLocaleString()})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-surface-400">Select karne par rate khud aa jayega - neeche adjust bhi kar sakte hain.</p>
            </div>
          )}

          {!["fertilizer", "spray", "seed", "land_prep", "labor"].includes(category) && (
            <div>
              <label className="text-xs font-medium text-surface-600">Kahan Se Liya?</label>
              <div className="mt-1 flex gap-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name="source" value="external" checked={source === "external"} onChange={() => setSource("external")} /> Bahar Se
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name="source" value="internal" checked={source === "internal"} onChange={() => setSource("internal")} /> Hamare System Se
                </label>
              </div>
            </div>
          )}
          {["fertilizer", "spray", "seed", "land_prep", "labor"].includes(category) && (
            <input type="hidden" name="source" value={source} />
          )}

          <div>
            <label className="text-xs font-medium text-surface-600">Amount (Rs.)</label>
            <input type="number" step="0.01" name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">Notes (optional)</label>
            <input type="text" name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" placeholder="e.g. DAP 1 bag" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function BookHarvestButton({ cropHistoryId }: { cropHistoryId: string }) {
  const [state, formAction] = useFormState(bookHarvestAction, initialState);
  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="crop_history_id" value={cropHistoryId} />
      <BookButton />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function BookButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Booking..." : "Book Harvest"}
    </button>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Add Kharcha"}
    </button>
  );
}