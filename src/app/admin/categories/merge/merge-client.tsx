"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight, AlertTriangle, CheckCircle2, Merge } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { mergeCategories, type MergeState } from "@/actions/category-merge";
import type { CategoryLite, Jodi } from "@/lib/products/category-pairs";

const initial: MergeState = {};

interface Purana {
  id: string;
  from: string;
  into: string;
  products: number;
  children: number;
  reason: string | null;
  waqt: string;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Mil raha hai…" : label}
    </Button>
  );
}

export function MergeClient({
  categories,
  jodiyan,
  purane,
}: {
  categories: CategoryLite[];
  jodiyan: Jodi[];
  purane: Purana[];
}) {
  const [state, action] = useFormState(mergeCategories, initial);
  // Kaunsi jodi khuli hui hai. Ek waqt mein ek -- do formein khuli hon
  // to banda ghalat wali bhar deta hai.
  const [khuli, setKhuli] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-900/50">
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Ye safha <b>faisla nahi karta</b> — sirf ye batata hai ke kaun se do naam bohot milte hain aur
          har ek mein kitna maal hai. Milana aap tay karte hain.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-surface-500 dark:text-surface-400">
          Milte julte naam ka matlab hamesha &ldquo;ek hi cheez&rdquo; nahi hota — <b>Poultry Feed</b> aur{" "}
          <b>Cattle/Dairy Feed</b> ke aadhe lafz ek hain magar wo do alag cheezein hain, aur unhen mila
          dena poultry ka stock hamesha ke liye cattle mein daal dega. <b>Ye kaam ulta nahi hota</b>: product
          ek ek kar ke wapas bhejne parenge. Isi liye wajah likhna zaroori hai.
        </p>
      </Card>

      {state.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
          </p>
        </Card>
      )}
      {state.notice && !state.error && (
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20">
          <p className="flex items-start gap-2 text-sm text-brand-800 dark:text-brand-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.notice}
          </p>
        </Card>
      )}

      {/* -------- Tajweez -------- */}
      <Card className="p-0">
        <p className="border-b border-surface-100 px-5 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
          Jo jodiyan ek jaisi lagti hain ({jodiyan.length})
        </p>

        {jodiyan.length === 0 ? (
          <p className="px-5 py-6 text-sm text-surface-500 dark:text-surface-400">
            Koi do naam itne nahi milte ke tajweez di jaye. Neeche wale khane se phir bhi koi bhi do
            categories milayi ja sakti hain.
          </p>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {jodiyan.map((j) => {
              const key = `${j.a.id}-${j.b.id}`;
              const open = khuli === key;
              // Jis mein zyada maal hai wo bacha rehna chahiye -- kam
              // wali us mein jaye. Ye sirf tajweez hai, badla ja sakta hai.
              const bara = j.a.products >= j.b.products ? j.a : j.b;
              const chhota = bara.id === j.a.id ? j.b : j.a;

              return (
                <li key={key} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-surface-900 dark:text-white">
                      {chhota.name}
                      <span className="ms-1 text-xs font-normal text-surface-400">
                        ({chhota.products} product)
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-surface-300" />
                    <span className="text-sm font-medium text-surface-900 dark:text-white">
                      {bara.name}
                      <span className="ms-1 text-xs font-normal text-surface-400">
                        ({bara.products} product)
                      </span>
                    </span>
                    <span className="ms-auto text-[11px] text-surface-400">{j.wajah}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={open ? "ghost" : "secondary"}
                      onClick={() => setKhuli(open ? null : key)}
                    >
                      {open ? "rehne dein" : "milayein"}
                    </Button>
                  </div>

                  {open && (
                    <form action={action} className="mt-3 grid gap-3 rounded-lg bg-surface-50 p-3 sm:grid-cols-3 dark:bg-surface-800/50">
                      <div>
                        <Label htmlFor={`f-${key}`}>Kaunsi khatam ho</Label>
                        <Select id={`f-${key}`} name="from_id" defaultValue={chhota.id}>
                          <option value={chhota.id}>{chhota.name}</option>
                          <option value={bara.id}>{bara.name}</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`t-${key}`}>Kis mein jaye</Label>
                        <Select id={`t-${key}`} name="into_id" defaultValue={bara.id}>
                          <option value={bara.id}>{bara.name}</option>
                          <option value={chhota.id}>{chhota.name}</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`r-${key}`}>Wajah</Label>
                        <Input id={`r-${key}`} name="reason" required placeholder="ek hi cheez ke do naam the" />
                      </div>
                      <div className="sm:col-span-3">
                        <Submit label="Mila dein" />
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* -------- Haath se -------- */}
      <Card>
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
          <Merge className="h-4 w-4 text-brand-600" /> Koi bhi do categories
        </p>
        <p className="mb-3 text-[11px] text-surface-500">
          Jo jodi upar na aayi ho, wo yahan se milayein.
        </p>
        <form action={action} className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="from_id">Kaunsi khatam ho</Label>
            <Select id="from_id" name="from_id" required defaultValue="">
              <option value="">— chunein —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.products})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="into_id">Kis mein jaye</Label>
            <Select id="into_id" name="into_id" required defaultValue="">
              <option value="">— chunein —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.products})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">Wajah</Label>
            <Input id="reason" name="reason" required placeholder="kam az kam paanch harf" />
          </div>
          <div className="sm:col-span-3">
            <Submit label="Mila dein" />
          </div>
        </form>
      </Card>

      {/* -------- Jo pehle mil chuki hain -------- */}
      {purane.length > 0 && (
        <Card className="p-0">
          <p className="border-b border-surface-100 px-5 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
            Jo pehle mil chuki hain
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
                <tr>
                  <th className="px-4 py-2">Tareekh</th>
                  <th className="px-4 py-2">Kaunsi</th>
                  <th className="px-4 py-2">Kis mein</th>
                  <th className="px-4 py-2 text-right">Hile</th>
                  <th className="px-4 py-2">Wajah</th>
                </tr>
              </thead>
              <tbody>
                {purane.map((m) => (
                  <tr key={m.id} className="border-t border-surface-100 dark:border-surface-800">
                    <td className="px-4 py-2 text-xs tabular-nums text-surface-500">
                      {new Date(m.waqt).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-4 py-2">{m.from}</td>
                    <td className="px-4 py-2">{m.into}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {m.products}
                      {m.children > 0 ? ` + ${m.children} sub` : ""}
                    </td>
                    <td className="px-4 py-2 text-xs text-surface-500">{m.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
