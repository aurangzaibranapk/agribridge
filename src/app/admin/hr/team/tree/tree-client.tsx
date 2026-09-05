"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, Users, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Input } from "@/components/ui/form";

export interface OrgRow {
  id: string;
  naam: string;
  role: string;
  ohda: string | null;
  shoba: string | null;
  shakha: string | null;
  afsar: string | null;
  afsarNaam: string | null;
  neechay: number;
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
}: {
  banda: OrgRow;
  bacchay: Map<string, OrgRow[]>;
  gehrai: number;
  khulay: Set<string>;
  toggle: (id: string) => void;
  chamak: string;
  khudId: string;
  chalaGaya: Set<string>;
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
      (banda.shoba ?? "").toLowerCase().includes(chamak));

  return (
    <li className="relative ps-6">
      {/* Shakh ki lakeer: ooper wale se aane wala L. */}
      {gehrai > 0 && (
        <>
          <span className="absolute start-0 top-0 h-[1.6rem] w-px bg-surface-200 dark:bg-surface-700" />
          <span className="absolute start-0 top-[1.6rem] h-px w-4 bg-surface-200 dark:bg-surface-700" />
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

        <span className="font-medium text-surface-900 dark:text-white">{banda.naam}</span>
        {banda.id === khudId && <Badge tone="green">aap</Badge>}
        {banda.ohda && <span className="text-xs text-surface-500 dark:text-surface-400">{banda.ohda}</span>}
        <Badge tone="gray">{ROLE_LABEL[banda.role] ?? banda.role}</Badge>
        {banda.shoba && <span className="text-xs text-surface-400">{banda.shoba}</span>}
        {banda.shakha && <span className="text-xs text-surface-400">· {banda.shakha}</span>}
        {meray.length > 0 && (
          <span className="ms-auto inline-flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
            <Users className="h-3 w-3" /> {meray.length}
          </span>
        )}
        {!banda.afsar && gehrai === 0 && <Badge tone="amber">afsar darj nahi</Badge>}
      </div>

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
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgTreeClient({
  rows,
  bahar,
  khudId,
}: {
  rows: OrgRow[];
  bahar: string[];
  khudId: string;
}) {
  const [talash, setTalash] = useState("");

  const { bacchay, jaRein, binaAfsar } = useMemo(() => {
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
    for (const list of bacchay.values()) list.sort((a, b) => a.naam.localeCompare(b.naam));
    jaRein.sort((a, b) => a.naam.localeCompare(b.naam));
    return { bacchay, jaRein, binaAfsar: rows.filter((r) => !r.afsar).length };
  }, [rows]);

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
          Abhi kisi ka HR record mukammal nahi, is liye darakht khaali hai.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
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
            />
          ))}
        </ul>
      </Card>

      {bahar.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {bahar.length} log darakht se bahar hain
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            In ka HR record (shoba, ohda, afsar) darj nahi, is liye ye kisi shakh par nahi aate.
            Team wale safhe par in ka record mukammal karein: {bahar.join("، ")}
          </p>
        </Card>
      )}
    </div>
  );
}
