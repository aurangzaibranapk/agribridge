"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Camera, CheckCircle2, Fuel, Mic, Play, Square, Wrench, Zap } from "lucide-react";
import { aajKaKhana } from "@/lib/utils/format";
import { addRouteFuel, closeMotorcycleRoute, startMotorcycleRoute, type FleetActionState } from "@/actions/fleet-dashboard";

const initial: FleetActionState = {};
type Vehicle = { id: string; vehicle_name: string; registration_no: string | null; assigned_rider: string | null; expected_km_per_liter: number };
type Route = any;

export function FleetDashboard({ vehicles, routes, generators, maintenance }: { vehicles: Vehicle[]; routes: Route[]; generators: any[]; maintenance: any[] }) {
  const [tab, setTab] = useState<"route" | "generator" | "maintenance" | "statement">("route");
  const openRoutes = routes.filter((r) => r.route_status === "open");
  const totalMilk = routes.reduce((sum, r) => sum + Number(r.milk_volume_collected ?? 0), 0);
  const totalFuel = routes.reduce((sum, r) => sum + Number(r.fuel_cost ?? 0), 0);
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric title="Open Routes" value={openRoutes.length} />
      <Metric title="Milk Collected" value={`${totalMilk.toFixed(1)} L`} />
      <Metric title="Petrol Expense" value={`Rs ${totalFuel.toFixed(0)}`} />
      <Metric title="Motorcycles" value={vehicles.length} />
    </div>
    <div className="flex flex-wrap gap-2 rounded-xl border border-surface-200 bg-white p-2 shadow-card">
      <Tab active={tab === "route"} onClick={() => setTab("route")} icon={<Fuel className="h-4 w-4" />}>Route & Petrol</Tab>
      <Tab active={tab === "generator"} onClick={() => setTab("generator")} icon={<Zap className="h-4 w-4" />}>Generator</Tab>
      <Tab active={tab === "maintenance"} onClick={() => setTab("maintenance")} icon={<Wrench className="h-4 w-4" />}>Maintenance</Tab>
      <Tab active={tab === "statement"} onClick={() => setTab("statement")} icon={<CheckCircle2 className="h-4 w-4" />}>Statements</Tab>
    </div>
    {tab === "route" && <RouteTab vehicles={vehicles} routes={routes} />}
    {tab === "generator" && <SimpleTable title="Generator records" rows={generators} columns={["log_date", "branch_name", "hours_run", "diesel_liters_purchased", "diesel_cost", "electricity_units"]} />}
    {tab === "maintenance" && <SimpleTable title="Motorcycle maintenance" rows={maintenance} columns={["service_date", "vehicle_name", "km_at_service", "description", "cost"]} />}
    {tab === "statement" && <Statement routes={routes} />}
  </div>;
}

function RouteTab({ vehicles, routes }: { vehicles: Vehicle[]; routes: Route[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
    <div className="space-y-4"><StartRouteForm vehicles={vehicles} />
      {routes.filter((r) => r.route_status === "open").map((r) => <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="font-semibold">{r.vehicle_name} · {r.route_name ?? "Route"}</p><p className="text-xs text-surface-600">Start {r.opening_km} km · {r.log_date}</p><button onClick={() => setSelected(r.id)} className="mt-2 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">Petrol / Route Close</button>{selected === r.id && <div className="mt-3"><FuelAndCloseForm route={r} onDone={() => setSelected(null)} /></div>}</div>)}
    </div>
    <div className="overflow-auto rounded-xl border border-surface-200 bg-white shadow-card"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b bg-surface-50 text-left"><th className="p-3">Date</th><th className="p-3">Motorcycle</th><th className="p-3">Route</th><th className="p-3">Start → End</th><th className="p-3">KM</th><th className="p-3">Petrol</th><th className="p-3">Milk</th><th className="p-3">Statement</th></tr></thead><tbody>{routes.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="p-3">{r.log_date}</td><td className="p-3">{r.vehicle_name}</td><td className="p-3">{r.route_name ?? "-"}</td><td className="p-3">{r.opening_km} → {r.closing_km ?? "open"}</td><td className="p-3">{r.km_travelled ?? "-"}</td><td className="p-3">{r.fuel_liters_purchased ? `${r.fuel_liters_purchased} L / Rs ${r.fuel_cost ?? 0}` : "-"}</td><td className="p-3">{r.milk_volume_collected ?? "-"} L</td><td className="p-3">{r.route_status === "closed" ? <span className="text-green-700">Closed</span> : <span className="text-amber-700">Open</span>}</td></tr>)}</tbody></table></div>
  </div>;
}

function StartRouteForm({ vehicles }: { vehicles: Vehicle[] }) {
  const [state, action] = useFormState(startMotorcycleRoute, initial);
  return <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card"><h2 className="mb-3 flex items-center gap-2 font-semibold"><Play className="h-4 w-4 text-brand-600" />Route Start</h2>{state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}{state.success && <p className="mb-2 text-xs text-green-600">Route start save ho gaya.</p>}<form action={action} encType="multipart/form-data" className="space-y-2"><select name="vehicle_id" required className="w-full rounded-lg border p-2 text-sm"><option value="">Motorcycle select karein</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicle_name} {v.assigned_rider ? `— ${v.assigned_rider}` : ""}</option>)}</select><input name="route_name" placeholder="Route / area" className="w-full rounded-lg border p-2 text-sm" /><input type="date" name="log_date" defaultValue={aajKaKhana()} className="w-full rounded-lg border p-2 text-sm" /><input type="number" step="0.1" min="0" name="opening_km" required placeholder="Start meter reading" className="w-full rounded-lg border p-2 text-sm" /><label className="flex items-center gap-2 rounded-lg border p-2 text-xs"><Camera className="h-4 w-4" />Start meter photo<input type="file" name="opening_meter_photo" accept="image/*" capture="environment" className="min-w-0 text-xs" /></label><Submit label="Route Start Save Karein" /></form></div>;
}

function FuelAndCloseForm({ route, onDone }: { route: Route; onDone: () => void }) {
  const [fuelState, fuelAction] = useFormState(addRouteFuel, initial);
  const [closeState, closeAction] = useFormState(closeMotorcycleRoute, initial);
  const [voice, setVoice] = useState("");
  const startVoice = () => { const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!Speech) return; const rec = new Speech(); rec.lang = "ur-PK"; rec.onresult = (e: any) => setVoice(e.results[0][0].transcript); rec.start(); };
  return <div className="space-y-3 rounded-lg border border-surface-200 bg-white p-3"><form action={fuelAction} encType="multipart/form-data" className="space-y-2"><input type="hidden" name="route_id" value={route.id} /><p className="text-xs font-semibold">Petrol entry</p><div className="grid grid-cols-2 gap-2"><input type="number" step="0.01" name="fuel_liters" placeholder="Petrol litres" className="rounded-lg border p-2 text-sm" /><input type="number" step="0.01" name="petrol_rate" placeholder="Rate / litre" className="rounded-lg border p-2 text-sm" /></div><input type="file" name="fuel_receipt" accept="image/*" capture="environment" className="w-full text-xs" /><Submit label="Petrol Save" />{fuelState.error && <p className="text-xs text-red-600">{fuelState.error}</p>}</form><form action={closeAction} encType="multipart/form-data" className="space-y-2 border-t pt-3"><input type="hidden" name="route_id" value={route.id} /><p className="flex items-center gap-2 text-xs font-semibold"><Square className="h-4 w-4 text-red-600" />Route close</p><input type="number" step="0.1" min={route.opening_km} name="closing_km" required placeholder="End meter reading" className="w-full rounded-lg border p-2 text-sm" /><input type="number" step="0.1" name="milk_volume" placeholder="Aaj collected milk (litres)" className="w-full rounded-lg border p-2 text-sm" /><input type="file" name="closing_meter_photo" accept="image/*" capture="environment" className="w-full text-xs" /><div className="flex gap-2"><textarea name="work_description" placeholder="Aaj kya kaam hua" rows={2} className="w-full rounded-lg border p-2 text-sm" value={voice} onChange={(e) => setVoice(e.target.value)} /><button type="button" onClick={startVoice} title="Voice note" className="h-10 rounded-lg border p-2"><Mic className="h-4 w-4" /></button></div><input type="hidden" name="voice_note" value={voice} /><Submit label="Route Close & Statement Save" />{closeState.error && <p className="text-xs text-red-600">{closeState.error}</p>}{closeState.success && <p className="text-xs text-green-600">Route close ho gaya.</p>}</form></div>;
}

function Statement({ routes }: { routes: Route[] }) { return <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card"><h2 className="mb-3 font-semibold">Motorcycle statement</h2><p className="mb-3 text-xs text-surface-500">Start reading, end reading, petrol, milk aur kaam ka record isi table se print/download kiya ja sakta hai.</p><div className="overflow-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Motorcycle</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2">KM</th><th className="p-2">Petrol cost</th><th className="p-2">Milk</th><th className="p-2">Work</th></tr></thead><tbody>{routes.map((r) => <tr key={r.id} className="border-b"><td className="p-2">{r.log_date}</td><td className="p-2">{r.vehicle_name}</td><td className="p-2">{r.opening_km}</td><td className="p-2">{r.closing_km ?? "-"}</td><td className="p-2">{r.km_travelled ?? "-"}</td><td className="p-2">{r.fuel_cost ? `Rs ${r.fuel_cost}` : "-"}</td><td className="p-2">{r.milk_volume_collected ?? "-"}</td><td className="p-2">{r.work_description ?? "-"}</td></tr>)}</tbody></table></div></div>; }
function SimpleTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) { return <div className="overflow-auto rounded-xl border border-surface-200 bg-white p-4 shadow-card"><h2 className="mb-3 font-semibold">{title}</h2><table className="w-full min-w-[600px] text-sm"><thead><tr className="border-b text-left">{columns.map((c) => <th key={c} className="p-2">{c.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id ?? i} className="border-b">{columns.map((c) => <td key={c} className="p-2">{r[c] ?? "-"}</td>)}</tr>)}</tbody></table></div>; }
function Metric({ title, value }: { title: string; value: string | number }) { return <div className="rounded-xl border border-surface-200 bg-white p-3 shadow-card"><p className="text-xs text-surface-500">{title}</p><p className="mt-1 text-xl font-semibold text-surface-900">{value}</p></div>; }
function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100"}`}>{icon}{children}</button>; }
function Submit({ label }: { label: string }) { const { pending } = useFormStatus(); return <button disabled={pending} className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? "Saving..." : label}</button>; }
