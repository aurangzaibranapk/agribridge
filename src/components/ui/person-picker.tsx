"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Search, User } from "lucide-react";

export interface PersonOption {
  type: "farmer" | "customer";
  id: string;
  name: string;
  phone?: string | null;
  cnic?: string | null;
  subtitle?: string | null;
  /** Sirf jahan yeh pehle se, sasti tarah maloom ho — farmer ke liye khaali chhod dein. */
  balance?: number | null;
}

/**
 * Kisan ya customer dhoondein — naam, mobile, ya CNIC se.
 *
 * Malik (7 September): plain dropdown mein farmers ki poori fehrist
 * ghaib rehti thi aur search ka koi raasta nahi tha. Ye wahi tareeqa
 * hai jo `bill-rates` ke product picker mein pehle se hai — poori
 * fehrist yahan aati hai, search client-side hoti hai.
 */
export function PersonPicker({
  people,
  partyTypeName,
  partyIdName,
  defaultType,
  defaultId,
  placeholder = "Naam, mobile ya CNIC se dhoondein...",
  disabled,
  onChange,
}: {
  people: PersonOption[];
  partyTypeName: string;
  partyIdName: string;
  defaultType?: "farmer" | "customer" | null;
  defaultId?: string | null;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (person: PersonOption | null) => void;
}) {
  const [chosenKey, setChosenKey] = useState<string | null>(
    defaultId && defaultType ? `${defaultType}:${defaultId}` : null
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const chosen = useMemo(() => people.find((p) => `${p.type}:${p.id}` === chosenKey) ?? null, [people, chosenKey]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => `${p.name} ${p.phone ?? ""} ${p.cnic ?? ""}`.toLowerCase().includes(q)).slice(0, 25);
  }, [people, query]);

  function pick(p: PersonOption | null) {
    setChosenKey(p ? `${p.type}:${p.id}` : null);
    setQuery("");
    setOpen(false);
    onChange?.(p);
  }

  return (
    <div>
      <input type="hidden" name={partyTypeName} value={chosen?.type ?? ""} />
      <input type="hidden" name={partyIdName} value={chosen?.id ?? ""} />

      {chosen ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-base font-medium text-emerald-900 dark:text-emerald-200">{chosen.name}</span>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            {chosen.type === "farmer" ? "Kisan" : "Customer"}
          </span>
          {chosen.phone && <span className="text-xs text-emerald-800 dark:text-emerald-300">{chosen.phone}</span>}
          {!disabled && (
            <button type="button" onClick={() => pick(null)} className="ml-auto text-xs text-emerald-800 underline dark:text-emerald-300">
              badlein
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 dark:border-surface-700">
            <Search className="h-4 w-4 shrink-0 text-surface-400" />
            <input
              type="text"
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder={placeholder}
              className="w-full border-0 bg-transparent p-0 text-base outline-none placeholder:text-surface-400"
            />
          </div>

          {open && query.trim().length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg dark:border-surface-700 dark:bg-surface-900">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-xs text-surface-500">Koi nahi mila.</li>
              ) : (
                results.map((p) => (
                  <li key={`${p.type}:${p.id}`}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-surface-50 dark:hover:bg-surface-800"
                    >
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                        {p.type === "farmer" ? "Kisan" : "Customer"}
                      </span>
                      {p.phone && <span className="text-xs text-surface-500">{p.phone}</span>}
                      {p.subtitle && <span className="ml-auto text-xs text-surface-400">{p.subtitle}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sirf naam ka khana — magar type karte hi maujooda customer/kisan ki
 * suggestion dikhati hai. Ye kisi ka khata nahi banati (koi party_id
 * nahi jata), sirf likhai asaan karti hai — us waqt ke liye jahan naam
 * sirf record ke liye hai, ledger ke liye nahi (jaise Load & Bill ka
 * "Customer ka naam (marzi ka)").
 */
export function NameSuggest({
  id,
  name,
  people,
  placeholder,
  defaultValue = "",
}: {
  id?: string;
  name: string;
  people: PersonOption[];
  placeholder?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => `${p.name} ${p.phone ?? ""} ${p.cnic ?? ""}`.toLowerCase().includes(q)).slice(0, 10);
  }, [people, value]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-lg border border-surface-300 bg-transparent px-3 text-base outline-none placeholder:text-surface-400 focus:border-brand-500 dark:border-surface-700"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg dark:border-surface-700 dark:bg-surface-900">
          {results.map((p) => (
            <li key={`${p.type}:${p.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setValue(p.name);
                  setOpen(false);
                }}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-surface-50 dark:hover:bg-surface-800"
              >
                <User className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                <span className="text-sm font-medium">{p.name}</span>
                <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                  {p.type === "farmer" ? "Kisan" : "Customer"}
                </span>
                {p.phone && <span className="ml-auto text-xs text-surface-500">{p.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
