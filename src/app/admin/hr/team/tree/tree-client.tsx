"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChevronDown, ChevronRight, Search, Users, Pencil, UserRound } from "lucide-react";
import { saveReportingLine, type AttState } from "@/actions/hr-attendance";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";

export interface OrgRow {
  id: string;
  naam: string;
  role: string;
  ohda: string | null;
  darja: string | null;
  darjaNaam: string | null;
  shobaKey: string | null;
  shoba: string | null;
  shakhaId: string | null;
  shakha: string | null;
  afsar: string | null;
  afsarNaam: string | null;
  kaamKiQism: string;
  tasveer: string | null;
  recordHai: boolean;
}

interface Opt {
  key: string;
  label: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Malik",
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  hr: "HR",
  finance: "Finance",
  staff: "Staff",
  cashier: "Cashier",
  storekeeper: "Storekeeper",
};

const initialState: AttState = {};

/**
 * Shakal ka gol khana.
 *
 * Tasveer na ho to naam ke pehle do harf. Khali jagah ya ek jaisa
 * "koi nahi" ka nishan chhorna darakht ko ek jaisi qatarein bana deta
 * hai jahan aankh kuch pehchan hi nahi pati -- aur is safhe ka poora
 * maqsad hi pehchan hai.
 */
function Shakal({ naam, src, bara }: { naam: string; src: string | null; bara?: boolean }) {
  const nap = bara ? "h-10 w-10" : "h-8 w-8";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={naam}
        className={`${nap} shrink-0 rounded-full border border-surface-200 object-cover dark:border-surface-700`}
      />
    );
  }
  const harf = naam
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`${nap} flex shrink-0 items-center justify-center rounded-full border border-surface-200 bg-surface-100 text-xs font-semibold text-surface-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400`}
    >
      {harf || <UserRound className="h-4 w-4" />}
    </span>
  );
}

/** Ek bande ka khana — ohda, afsar, shoba, shakha. */
function BadalneKaKhana({
  banda,
  sabLog,
  positions,
  departments,
  branches,
  band,
}: {
  banda: OrgRow;
  sabLog: OrgRow[];
  positions: Opt[];
  departments: Opt[];
  branches: { id: string; name: string }[];
  band: () => void;
}) {
  const [state, action] = useFormState(saveReportingLine, initialState);

  return (
    <form
      action={action}
      className="my-2 grid gap-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3 sm:grid-cols-2 dark:border-brand-800 dark:bg-brand-950/20"
    >
      <input type="hidden" name="profile_id" value={banda.id} />

      <div>
        <Label>Ohda</Label>
        <Select name="position_key" defaultValue={banda.darja ?? ""}>
          <option value="">— chunein —</option>
          {positions.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Kis ke neeche (afsar)</Label>
        <Select name="reports_to" defaultValue={banda.afsar ?? ""}>
          <option value="">— koi nahi (sab se ooper) —</option>
          {sabLog
            .filter((p) => p.id !== banda.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.naam}
                {p.darjaNaam ? ` — ${p.darjaNaam}` : ""}
              </option>
            ))}
        </Select>
      </div>

      <div>
        <Label>Shoba</Label>
        <Select name="department_key" defaultValue={banda.shobaKey ?? ""}>
          <option value="">— koi nahi —</option>
          {departments.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Shakha</Label>
        <Select name="branch_id" defaultValue={banda.shakhaId ?? ""}>
          <option value="">— koi nahi —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Naukri ka naam (marzi se)</Label>
        <Input name="designation" defaultValue={banda.ohda ?? ""} placeholder="Warehouse Incharge" />
        <p className="mt-1 text-[11px] text-surface-400">
          Ye ohde se alag hai — ohda seerhi ka darja hai, ye kaam ka naam.
        </p>
      </div>

      <div>
        <Label>Kaam ki qism</Label>
        <Select name="employment_type" defaultValue={banda.kaamKiQism}>
          <option value="permanent">Permanent</option>
          <option value="probation">Aazmaishi</option>
          <option value="contract">Contract</option>
          <option value="daily_wage">Dihari</option>
        </Select>
      </div>

      {state.error && (
        <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="sm:col-span-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
          {state.notice}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <MehfoozButton />
        <button
          type="button"
          onClick={band}
          className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
        >
          Band karein
        </button>
      </div>
    </form>
  );
}

function MehfoozButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Mehfooz ho rahi hai…" : "Mehfooz karein"}
    </Button>
  );
}

/**
 * Darakht ka ek khana — ek banda aur us ke neeche wale.
 *
 * Shakh khud ko bulati hai, is liye kitni bhi gehri satah ho, code ek
 * hi rehta hai. Halqa (cycle) se bachne ke liye har raaste ka apna
 * `chalaGaya` set hai: agar A ka afsar B aur B ka afsar A darj ho jaye
 * to safha jam nahi hoga.
 */
function Shakh({
  banda,
  bacchay,
  gehrai,
  khulay,
  toggle,
  chamak,
  khudId,
  chalaGaya,
  canEdit,
  badalRahe,
  setBadalRahe,
  sabLog,
  positions,
  departments,
  branches,
}: {
  banda: OrgRow;
  bacchay: Map<string, OrgRow[]>;
  gehrai: number;
  khulay: Set<string>;
  toggle: (id: string) => void;
  chamak: string;
  khudId: string;
  chalaGaya: Set<string>;
  canEdit: boolean;
  badalRahe: string | null;
  setBadalRahe: (id: string | null) => void;
  sabLog: OrgRow[];
  positions: Opt[];
  departments: Opt[];
  branches: { id: string; name: string }[];
}) {
  if (chalaGaya.has(banda.id)) return null;
  const agla = new Set(chalaGaya);
  agla.add(banda.id);

  const meray = bacchay.get(banda.id) ?? [];
  const khula = khulay.has(banda.id);
  const milta =
    chamak.length > 1 &&
    (banda.naam.toLowerCase().includes(chamak) ||
      (banda.ohda ?? "").toLowerCase().includes(chamak) ||
      (banda.darjaNaam ?? "").toLowerCase().includes(chamak) ||
      (banda.shoba ?? "").toLowerCase().includes(chamak));

  return (
    <li className="relative ps-6">
      {/* Shakh ki lakeer: ooper wale se aane wala L. */}
      {gehrai > 0 && (
        <>
          <span className="absolute start-0 top-0 h-[1.9rem] w-px bg-surface-200 dark:bg-surface-700" />
          <span className="absolute start-0 top-[1.9rem] h-px w-4 bg-surface-200 dark:bg-surface-700" />
        </>
      )}

      <div
        className={
          "my-1 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 " +
          (milta
            ? "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
            : banda.id === khudId
              ? "border-brand-300 bg-white dark:border-brand-700 dark:bg-surface-900"
              : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900")
        }
      >
        {meray.length > 0 ? (
          <button
            type="button"
            onClick={() => toggle(banda.id)}
            aria-label={khula ? "band karein" : "kholein"}
            className="rounded p-0.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            {khula ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <Shakal naam={banda.naam} src={banda.tasveer} bara={gehrai === 0} />

        <span className="font-medium text-surface-900 dark:text-white">{banda.naam}</span>
        {banda.id === khudId && <Badge tone="green">aap</Badge>}
        {banda.darjaNaam && <Badge tone="blue">{banda.darjaNaam}</Badge>}
        {banda.ohda && <span className="text-xs text-surface-500 dark:text-surface-400">{banda.ohda}</span>}
        <Badge tone="gray">{ROLE_LABEL[banda.role] ?? banda.role}</Badge>
        {banda.shoba && <span className="text-xs text-surface-400">{banda.shoba}</span>}
        {banda.shakha && <span className="text-xs text-surface-400">· {banda.shakha}</span>}

        {/* Adhoora record chhupaya nahi jata. Banda darakht mein hai --
            magar us ka ohda aur afsar darj nahi, aur us ka natija ye hai
            ke wo jaR par para rehta hai aur us ki har darkhwast seedhi
            HR ke paas jati hai. */}
        {!banda.recordHai && <Badge tone="amber">HR record adhoora</Badge>}
        {banda.recordHai && !banda.darja && <Badge tone="amber">ohda darj nahi</Badge>}

        <span className="ms-auto flex items-center gap-2">
          {meray.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
              <Users className="h-3 w-3" /> {meray.length}
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setBadalRahe(badalRahe === banda.id ? null : banda.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
            >
              <Pencil className="h-3 w-3" /> Badlein
            </button>
          )}
        </span>
      </div>

      {canEdit && badalRahe === banda.id && (
        <BadalneKaKhana
          banda={banda}
          sabLog={sabLog}
          positions={positions}
          departments={departments}
          branches={branches}
          band={() => setBadalRahe(null)}
        />
      )}

      {khula && meray.length > 0 && (
        <ul className="relative">
          {/* Bacchon ko jorne wali seedhi lakeer. */}
          <span className="absolute start-0 top-0 h-full w-px bg-surface-200 dark:bg-surface-700" />
          {meray.map((b) => (
            <Shakh
              key={b.id}
              banda={b}
              bacchay={bacchay}
              gehrai={gehrai + 1}
              khulay={khulay}
              toggle={toggle}
              chamak={chamak}
              khudId={khudId}
              chalaGaya={agla}
              canEdit={canEdit}
              badalRahe={badalRahe}
              setBadalRahe={setBadalRahe}
              sabLog={sabLog}
              positions={positions}
              departments={departments}
              branches={branches}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgTreeClient({
  rows,
  khudId,
  canEdit,
  positions,
  departments,
  branches,
}: {
  rows: OrgRow[];
  khudId: string;
  canEdit: boolean;
  positions: Opt[];
  departments: Opt[];
  branches: { id: string; name: string }[];
}) {
  const [talash, setTalash] = useState("");
  const [badalRahe, setBadalRahe] = useState<string | null>(null);

  // Ohde ki tarteeb server se aati hai (rank ke hisaab se). Us ki jagah
  // yahan bhi ginti rakhi jati hai taake ek hi afsar ke neeche wale log
  // ohde ke hisaab se lagen -- naam ke alphabet se nahi. CEO ko Admin
  // ke neeche dikha dena darakht ko galat parhwata hai.
  const darjaTarteeb = useMemo(
    () => new Map(positions.map((p, i) => [p.key, i])),
    [positions]
  );

  const { bacchay, jaRein, binaAfsar, adhoore } = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    const bacchay = new Map<string, OrgRow[]>();
    const jaRein: OrgRow[] = [];
    for (const r of rows) {
      // Jis ka afsar is fehrist mein nahi (ya darj hi nahi), wo jaR par.
      if (r.afsar && ids.has(r.afsar) && r.afsar !== r.id) {
        bacchay.set(r.afsar, [...(bacchay.get(r.afsar) ?? []), r]);
      } else {
        jaRein.push(r);
      }
    }
    const lagao = (a: OrgRow, b: OrgRow) => {
      const da = darjaTarteeb.get(a.darja ?? "") ?? 999;
      const db = darjaTarteeb.get(b.darja ?? "") ?? 999;
      return da !== db ? da - db : a.naam.localeCompare(b.naam);
    };
    for (const list of bacchay.values()) list.sort(lagao);
    jaRein.sort(lagao);
    return {
      bacchay,
      jaRein,
      binaAfsar: rows.filter((r) => !r.afsar).length,
      adhoore: rows.filter((r) => !r.recordHai).length,
    };
  }, [rows, darjaTarteeb]);

  // Shuru mein sab khula -- dhaancha dekhne aaye hain, kholte rehna nahi.
  const [khulay, setKhulay] = useState<Set<string>>(() => new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setKhulay((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chamak = talash.trim().toLowerCase();

  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Abhi koi active mulazim nahi mila. Ye &quot;company khali hai&quot; nahi kehta — ho sakta hai
          aap ko sirf apni shakh dikhti ho.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Darakht mein log</p>
          <p className="font-display text-2xl font-semibold text-surface-900 dark:text-white">{rows.length}</p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Afsar darj nahi</p>
          <p className="font-display text-2xl font-semibold text-surface-900 dark:text-white">{binaAfsar}</p>
          <p className="mt-0.5 text-[11px] text-surface-400">In ki har darkhwast seedhi HR ke paas jati hai</p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">HR record adhoora</p>
          <p className="font-display text-2xl font-semibold text-surface-900 dark:text-white">{adhoore}</p>
          <p className="mt-0.5 text-[11px] text-surface-400">Ye log darakht mein hain, magar khaali khaanon ke sath</p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Ooper ki satah par</p>
          <p className="font-display text-2xl font-semibold text-surface-900 dark:text-white">{jaRein.length}</p>
        </Card>
      </div>

      <Card>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={talash}
            onChange={(e) => setTalash(e.target.value)}
            placeholder="Naam, ohda ya shoba se dhoondhein"
            className="ps-9"
          />
        </div>

        <ul className="relative">
          {jaRein.map((r) => (
            <Shakh
              key={r.id}
              banda={r}
              bacchay={bacchay}
              gehrai={0}
              khulay={khulay}
              toggle={toggle}
              chamak={chamak}
              khudId={khudId}
              chalaGaya={new Set()}
              canEdit={canEdit}
              badalRahe={badalRahe}
              setBadalRahe={setBadalRahe}
              sabLog={rows}
              positions={positions}
              departments={departments}
              branches={branches}
            />
          ))}
        </ul>

        <p className="mt-3 border-t border-surface-100 pt-3 text-xs text-surface-400 dark:border-surface-800">
          Tasveer har banda apne <strong>My HR</strong> safhe se khud lagata hai — yahan se nahi lagti.
        </p>
      </Card>
    </div>
  );
}
