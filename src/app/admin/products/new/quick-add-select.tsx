"use client";

import { useState } from "react";
import { addTaxonomyItemInline } from "@/actions/taxonomy";
import { Label, Select } from "@/components/ui/form";
import { Plus, X } from "lucide-react";

/**
 * Dropdown jis mein nayi qatar wahin ban jati hai.
 *
 * Malik ka kehna (5 September): *"yahan par company, brand ya category
 * add karna ho to option hona chahiye — wo add ho jayein."*
 *
 * Pehle iska sirf ek raasta tha: form chhor kar Categories ke safhe par
 * jao, wahan bana kar wapas aao. Wapas aane par product ka aadha bhara
 * hua form, tasveer, aur AI se nikli hui saari tafseel zaya. Is liye
 * log qism khali chhor dete the — aur POS par "Uncategorised" ka dher
 * lag jata tha.
 *
 * Ab naya naam usi jagah likha jata hai. Qatar banti hai, foran chun
 * bhi jati hai, aur form jyon ka tyon rehta hai.
 */
export function QuickAddSelect({
  id,
  name,
  label,
  table,
  options,
  value,
  onChange,
  onAdded,
  categoryKind,
}: {
  id: string;
  name: string;
  label: string;
  table: "categories" | "brands" | "companies";
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  /**
   * Sirf tab bulaya jata hai jab qatar YAHIN se chuni gayi -- dropdown
   * se badalne par nahi. Bulane wale ko is farq ki zaroorat parti hai:
   * nayi qism abhi server wali fehrist mein nahi hoti, is liye form ki
   * shakal us se tay nahi ho sakti.
   */
  onAdded?: (item: { id: string; name: string }) => void;
  /** Nayi qism karyana hai ya zarai -- sirf `categories` par. */
  categoryKind?: "karyana" | "agri";
}) {
  const [list, setList] = useState(options);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const clean = draft.trim();
    if (!clean) {
      setError("Naam likhein.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await addTaxonomyItemInline(table, clean, { categoryKind });
    setBusy(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    // Pehle se maujood naam par wohi qatar wapas aati hai -- do dafa
    // fehrist mein na aa jaye.
    setList((old) => (old.some((o) => o.id === result.id) ? old : [...old, result].sort((a, b) => a.name.localeCompare(b.name))));
    onChange(result.id);
    onAdded?.(result);
    setDraft("");
    setAdding(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <button
          type="button"
          onClick={() => {
            setAdding((a) => !a);
            setError(null);
          }}
          className="mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
        >
          {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {adding ? "band karein" : "naya"}
        </button>
      </div>

      {adding ? (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // Enter par form submit nahi hona chahiye -- warna adhoora
              // product mehfooz ho jata.
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
              placeholder={`Naya ${label}`}
              className="h-10 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900 outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="h-10 rounded-lg bg-brand-700 px-3 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? "..." : "Add"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ) : (
        <Select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">- select -</option>
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      )}

      {/* Naam likhne wala khana khula ho to Select safhe par nahi hota,
          aur us ki chuni hui qeemat form ke sath nahi jati. Ye chhupa
          hua khana wohi qeemat sath rakhta hai. */}
      {adding && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
