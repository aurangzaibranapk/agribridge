"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Trash2, Search, Wand2, Clock } from "lucide-react";
import { ACTIONS, ACTION_LABEL, DATA_SCOPES, SCOPE_LABEL, type Action } from "@/lib/access/types";
import { applyRoleTemplate, setFeatureAccess, removeFeatureAccess, type ActionState } from "@/actions/staff-access";

interface Banda {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}
interface Feature {
  key: string;
  label: string;
  route: string;
  is_sensitive: boolean;
}
interface Qatar {
  feature_key: string;
  actions: string[];
  data_scope: string;
  expires_at: string | null;
  reason: string | null;
}

const KHALI: ActionState = {};

function Dabao({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "khali" | "laal" }) {
  const { pending } = useFormStatus();
  const rang =
    tone === "brand"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "laal"
        ? "border border-red-200 text-red-700 hover:bg-red-50 dark:border-surface-700 dark:hover:bg-surface-800"
        : "border border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${rang}`}
    >
      {pending ? "..." : children}
    </button>
  );
}

/**
 * Ek jagah se poori ijazat.
 *
 * Do hisse hain aur wo jaan boojh kar alag hain:
 *
 *   1. TEMPLATE -- "ye banda is stage par aaya hai" (malik ka jumla).
 *      Ek dabao, aur us stage ki poori fehrist lag jati hai.
 *   2. HAATH SE -- us fehrist mein se kam ya zyada.
 *
 * Template lagane se jo cheez pehle se hai wo chhui NAHI jati. Warna
 * malik ki ki hui kami dobara template lagate hi ulat jati, aur us ka
 * pata bhi na chalta.
 */
export function StaffAccessClient({
  staff,
  features,
  templates,
  chunaHua,
  uskiIjazat,
}: {
  staff: Banda[];
  features: Feature[];
  templates: { role: string; ginti: number }[];
  chunaHua: string | null;
  uskiIjazat: Qatar[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [talaash, setTalaash] = useState("");

  const [templateState, templateAction] = useFormState(applyRoleTemplate, KHALI);
  const [setState, setAction] = useFormState(setFeatureAccess, KHALI);
  const [hataState, hataAction] = useFormState(removeFeatureAccess, KHALI);

  const banda = staff.find((s) => s.id === chunaHua) ?? null;

  const dikhne = useMemo(() => {
    const q = talaash.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.full_name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q));
  }, [staff, talaash]);

  const mili = useMemo(() => new Map(uskiIjazat.map((r) => [r.feature_key, r])), [uskiIjazat]);
  const featureKaNaam = useMemo(() => new Map(features.map((f) => [f.key, f])), [features]);

  const [naya, setNaya] = useState("");

  function chunein(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("banda", id);
    router.push(`/admin/staff-access?${p.toString()}`);
  }

  const paighaam = templateState.message ?? setState.message ?? hataState.message;
  const kharabi = templateState.error ?? setState.error ?? hataState.error;

  // Jo abhi tak nahi di gayin -- unhi mein se nayi chuni jati hai.
  const baqiFeatures = features.filter((f) => !mili.has(f.key));

  return (
    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
      {/* Bande ki fehrist */}
      <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-surface-200 px-2 py-1.5 dark:border-surface-700">
          <Search className="h-3.5 w-3.5 shrink-0 text-surface-400" />
          <input
            value={talaash}
            onChange={(e) => setTalaash(e.target.value)}
            placeholder="Naam ya department"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-[70vh] space-y-0.5 overflow-y-auto">
          {dikhne.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => chunein(s.id)}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                s.id === chunaHua
                  ? "bg-emerald-50 font-medium text-emerald-800 dark:bg-surface-800 dark:text-emerald-300"
                  : "text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800"
              }`}
            >
              <span className={s.is_active ? "" : "line-through opacity-60"}>{s.full_name}</span>
              <span className="ml-1.5 text-[11px] text-surface-400">{s.role}</span>
              {!s.is_active && <span className="ml-1 text-[11px] text-red-500">band</span>}
            </button>
          ))}
          {dikhne.length === 0 && <p className="px-2 py-3 text-xs text-surface-400">Koi nahi mila.</p>}
        </div>
      </div>

      {/* Us bande ki ijazat */}
      <div>
        {!banda ? (
          <div className="rounded-card border border-dashed border-surface-300 p-8 text-center text-sm text-surface-400 dark:border-surface-700">
            Bayein taraf se banda chunein.
          </div>
        ) : (
          <div className="space-y-4">
            {paighaam && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-surface-800 dark:bg-surface-900 dark:text-emerald-300">
                {paighaam}
              </p>
            )}
            {kharabi && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-surface-800 dark:bg-surface-900 dark:text-red-300">
                {kharabi}
              </p>
            )}

            {/* 1) Stage ka template */}
            <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                <Wand2 className="h-4 w-4 text-surface-400" /> {banda.full_name} — stage ka template
              </h2>
              <p className="mb-3 mt-1 text-xs text-surface-400">
                Ek dabao mein us stage ki poori fehrist lag jati hai. Jo cheez is ke paas pehle se hai, wo chhui nahi
                jati — aap ne jo kami ki thi wo qayam rehti hai.
              </p>
              <form action={templateAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="profile_id" value={banda.id} />
                <label className="text-xs text-surface-500">
                  <span className="mb-1 block">Template</span>
                  <select
                    name="template"
                    defaultValue={banda.role}
                    className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
                  >
                    {templates.map((tp) => (
                      <option key={tp.role} value={tp.role}>
                        {tp.role} ({tp.ginti} cheezein)
                      </option>
                    ))}
                  </select>
                </label>
                <Dabao>Template lagayein</Dabao>
              </form>
            </div>

            {/* 2) Haath se */}
            <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                Is waqt kya khulta hai ({uskiIjazat.length})
              </h2>
              <p className="mb-3 mt-1 text-xs text-surface-400">
                &quot;Dekhna&quot; khud lag jata hai — bina dekhe koi kaam chal hi nahi sakta.
              </p>

              {uskiIjazat.length === 0 && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-surface-800 dark:bg-surface-900 dark:text-amber-300">
                  Is ke paas abhi kuch nahi khulta. Ooper se stage ka template lagayein.
                </p>
              )}

              <div className="space-y-2">
                {uskiIjazat.map((r) => {
                  const f = featureKaNaam.get(r.feature_key);
                  return (
                    <div
                      key={r.feature_key}
                      className="rounded-lg border border-surface-100 p-3 dark:border-surface-800"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                            {f?.label ?? r.feature_key}
                            {f?.is_sensitive && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-surface-800 dark:text-red-300">
                                hassas
                              </span>
                            )}
                            {r.expires_at && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-surface-800 dark:text-amber-300">
                                <Clock className="h-3 w-3" />
                                {new Date(r.expires_at).toLocaleDateString()} tak
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-surface-400">{f?.route ?? r.feature_key}</p>
                        </div>
                        <form action={hataAction}>
                          <input type="hidden" name="profile_id" value={banda.id} />
                          <input type="hidden" name="feature_key" value={r.feature_key} />
                          <Dabao tone="laal">
                            <span className="inline-flex items-center gap-1">
                              <Trash2 className="h-3 w-3" /> Hatayein
                            </span>
                          </Dabao>
                        </form>
                      </div>

                      <form action={setAction} className="flex flex-wrap items-end gap-x-4 gap-y-2">
                        <input type="hidden" name="profile_id" value={banda.id} />
                        <input type="hidden" name="feature_key" value={r.feature_key} />
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {ACTIONS.map((a) => (
                            <label key={a} className="flex items-center gap-1 text-xs text-surface-600 dark:text-surface-400">
                              <input
                                type="checkbox"
                                name="actions"
                                value={a}
                                defaultChecked={r.actions.includes(a)}
                                disabled={a === "view"}
                              />
                              {ACTION_LABEL[a as Action]}
                            </label>
                          ))}
                          {/* `view` hamesha jata hai -- checkbox band hone par form use nahi bhejta. */}
                          <input type="hidden" name="actions" value="view" />
                        </div>
                        <label className="text-xs text-surface-500">
                          <span className="mb-1 block">Data ki hadd</span>
                          <select
                            name="data_scope"
                            defaultValue={r.data_scope}
                            className="rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                          >
                            {DATA_SCOPES.map((sc) => (
                              <option key={sc} value={sc}>
                                {SCOPE_LABEL[sc]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Dabao tone="khali">
                          <span className="inline-flex items-center gap-1">
                            <Check className="h-3 w-3" /> Mehfooz
                          </span>
                        </Dabao>
                      </form>
                    </div>
                  );
                })}
              </div>

              {/* Nayi cheez dena */}
              {baqiFeatures.length > 0 && (
                <form action={setAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-surface-100 pt-4 dark:border-surface-800">
                  <input type="hidden" name="profile_id" value={banda.id} />
                  <input type="hidden" name="actions" value="view" />
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">Nayi cheez dein</span>
                    <select
                      name="feature_key"
                      value={naya}
                      onChange={(e) => setNaya(e.target.value)}
                      className="max-w-xs rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
                    >
                      <option value="">— chunein —</option>
                      {baqiFeatures.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {f.is_sensitive ? " (hassas)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">Data ki hadd</span>
                    <select
                      name="data_scope"
                      defaultValue="own_shop"
                      className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
                    >
                      {DATA_SCOPES.map((sc) => (
                        <option key={sc} value={sc}>
                          {SCOPE_LABEL[sc]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Dabao>Dein (sirf dekhna)</Dabao>
                  <p className="w-full text-[11px] text-surface-400">
                    Shuru mein sirf &quot;dekhna&quot; milta hai. Baqi kaam ooper wali qatar se khol dein — is tarah
                    galti se &quot;banana&quot; ya &quot;badalna&quot; khul jana mumkin nahi rehta.
                  </p>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
