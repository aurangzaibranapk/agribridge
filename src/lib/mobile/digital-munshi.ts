import { liveGet, loadMyFarmerId, type LiveAuth, type ReadResult } from "./live-read";
import type { FetchLike } from "./live-login";

export type MunshiFarmer = {
  id?: string;
  full_name?: string | null;
  farmer_code?: string | null;
  village?: string | null;
  land_size_acres?: number | string | null;
  cow_count?: number | string | null;
  buffalo_count?: number | string | null;
};
export type MunshiFarm = { id?: string; name?: string | null; area_acres?: number | string | null; village?: string | null; is_verified?: boolean | null };
export type MunshiCrop = { id?: string; farm_id?: string | null; crop_name?: string | null; sowing_date?: string | null; expected_harvest_date?: string | null; area_sown_acres?: number | string | null };
export type MunshiExpense = { crop_history_id?: string | null; amount?: number | string | null; expense_category?: string | null };
export type MunshiAnimal = { id?: string; tag_no?: string | null; name?: string | null; species?: string | null; breed?: string | null; status?: string | null };
export type MunshiYield = { animal_id?: string | null; yield_date?: string | null; shift?: string | null; liters?: number | string | null };
export type MunshiMachinery = { id?: string; booking_number?: string | null; status?: string | null; booking_date?: string | null; crop_type?: string | null; harvest_area?: number | string | null };
export type MunshiDemand = { id?: string; product_name?: string | null; quantity?: number | string | null; unit?: string | null; status?: string | null; created_at?: string | null };
export type MunshiProduce = { id?: string; crop_name?: string | null; quantity_available?: number | string | null; unit?: string | null; status?: string | null; asking_price_per_unit?: number | string | null };
export type MunshiReminder = { id?: string; farmer_id?: string | null; task?: string | null; due_date?: string | null; animal_id?: string | null; seen_at?: string | null };
export type MunshiHealth = { id?: string; animal_id?: string | null; kind?: string | null; event_date?: string | null; next_due?: string | null; diagnosis?: string | null; medicine?: string | null; vet_name?: string | null; notes?: string | null };
export type MunshiCredit = { ledger_type?: string | null; amount?: number | string | null; created_at?: string | null; source_type?: string | null };

export type DigitalMunshiData = {
  farmerId: string | null;
  profile: MunshiFarmer | null;
  farms: MunshiFarm[];
  crops: MunshiCrop[];
  expenses: MunshiExpense[];
  animals: MunshiAnimal[];
  yields: MunshiYield[];
  machinery: MunshiMachinery[];
  demands: MunshiDemand[];
  produce: MunshiProduce[];
  reminders: MunshiReminder[];
  health: MunshiHealth[];
  credit: MunshiCredit[];
  notes: string[];
};

function collect<T>(result: ReadResult<T>, notes: string[]): T[] {
  if (result.ok) return result.rows;
  notes.push(result.message);
  return [];
}

export async function loadDigitalMunshi(auth: LiveAuth, fetchImpl: FetchLike): Promise<DigitalMunshiData> {
  const farmerId = await loadMyFarmerId(auth, fetchImpl);
  if (!farmerId) return { farmerId: null, profile: null, farms: [], crops: [], expenses: [], animals: [], yields: [], machinery: [], demands: [], produce: [], reminders: [], health: [], credit: [], notes: ["Is login ka linked farmer record nahi mila."] };
  const id = encodeURIComponent(farmerId);
  const notes: string[] = [];
  const [profileR, farmsR, animalsR, yieldsR, machineryR, demandsR, produceR, remindersR, healthR, creditR] = await Promise.all([
    liveGet<MunshiFarmer>(auth, `farmers?select=id,full_name,farmer_code,village,land_size_acres,cow_count,buffalo_count&id=eq.${id}&limit=1`, fetchImpl),
    liveGet<MunshiFarm>(auth, `farms?select=id,name,area_acres,village,is_verified&farmer_id=eq.${id}&order=created_at.desc&limit=100`, fetchImpl),
    liveGet<MunshiAnimal>(auth, `dairy_animals?select=id,tag_no,name,species,breed,status&farmer_id=eq.${id}&order=tag_no.asc&limit=200`, fetchImpl),
    liveGet<MunshiYield>(auth, `dairy_milk_yields?select=animal_id,yield_date,shift,liters&farmer_id=eq.${id}&order=yield_date.desc&limit=300`, fetchImpl),
    liveGet<MunshiMachinery>(auth, `machinery_bookings?select=id,booking_number,status,booking_date,crop_type,harvest_area&farmer_id=eq.${id}&order=created_at.desc&limit=40`, fetchImpl),
    liveGet<MunshiDemand>(auth, `farmer_product_demands?select=id,product_name,quantity,unit,status,created_at&farmer_id=eq.${id}&order=created_at.desc&limit=40`, fetchImpl),
    liveGet<MunshiProduce>(auth, `produce_listings?select=id,crop_name,quantity_available,unit,status,asking_price_per_unit&farmer_id=eq.${id}&order=created_at.desc&limit=40`, fetchImpl),
    liveGet<MunshiReminder>(auth, `dairy_reminders?select=id,task,due_date,animal_id,seen_at&farmer_id=eq.${id}&order=due_date.asc&limit=40`, fetchImpl),
    liveGet<MunshiHealth>(auth, `dairy_health_events?select=id,animal_id,kind,event_date,next_due,diagnosis,medicine,vet_name,notes&farmer_id=eq.${id}&voided=eq.false&order=event_date.desc&limit=80`, fetchImpl),
    liveGet<MunshiCredit>(auth, `farmer_credit_ledger?select=ledger_type,amount,created_at,source_type&farmer_id=eq.${id}&order=created_at.desc&limit=100`, fetchImpl),
  ]);
  const farms = collect(farmsR, notes);
  const farmIds = farms.map((row) => row.id).filter((value): value is string => Boolean(value));
  const cropsR: ReadResult<MunshiCrop> = farmIds.length
    ? await liveGet<MunshiCrop>(auth, `crop_history?select=id,farm_id,crop_name,sowing_date,expected_harvest_date,area_sown_acres&farm_id=in.(${farmIds.map(encodeURIComponent).join(",")})&order=sowing_date.desc&limit=200`, fetchImpl)
    : { ok: true, rows: [] };
  const crops = collect(cropsR, notes);
  const cropIds = crops.map((row) => row.id).filter((value): value is string => Boolean(value));
  const expensesR: ReadResult<MunshiExpense> = cropIds.length
    ? await liveGet<MunshiExpense>(auth, `crop_expenses?select=crop_history_id,amount,expense_category&crop_history_id=in.(${cropIds.map(encodeURIComponent).join(",")})&limit=500`, fetchImpl)
    : { ok: true, rows: [] };
  return {
    farmerId,
    profile: collect(profileR, notes)[0] ?? null,
    farms,
    crops,
    expenses: collect(expensesR, notes),
    animals: collect(animalsR, notes),
    yields: collect(yieldsR, notes),
    machinery: collect(machineryR, notes),
    demands: collect(demandsR, notes),
    produce: collect(produceR, notes),
    reminders: collect(remindersR, notes),
    health: collect(healthR, notes),
    credit: collect(creditR, notes),
    notes: [...new Set(notes)],
  };
}

export type AdminDigitalOverview = {
  farmers: number | null;
  farms: number | null;
  crops: number | null;
  animals: number | null;
  vetOpen: number | null;
  machineryOpen: number | null;
  demandsOpen: number | null;
  notes: string[];
};

export async function loadAdminDigitalOverview(auth: LiveAuth, fetchImpl: FetchLike): Promise<AdminDigitalOverview> {
  const notes: string[] = [];
  const [farmers, farms, crops, animals, health, machinery, demands] = await Promise.all([
    liveGet<{ id?: string }>(auth, "farmers?select=id&limit=500", fetchImpl),
    liveGet<{ id?: string }>(auth, "farms?select=id&limit=500", fetchImpl),
    liveGet<{ id?: string }>(auth, "crop_history?select=id&limit=500", fetchImpl),
    liveGet<{ id?: string; status?: string | null }>(auth, "dairy_animals?select=id,status&limit=500", fetchImpl),
    liveGet<{ id?: string; next_due?: string | null; voided?: boolean | null }>(auth, "dairy_health_events?select=id,next_due,voided&voided=eq.false&limit=500", fetchImpl),
    liveGet<{ id?: string; status?: string | null }>(auth, "machinery_bookings?select=id,status&limit=500", fetchImpl),
    liveGet<{ id?: string; status?: string | null }>(auth, "farmer_product_demands?select=id,status&limit=500", fetchImpl),
  ]);
  function count<T>(result: ReadResult<T>): number | null { if (result.ok) return result.rows.length; notes.push(result.message); return null; }
  const animalRows = animals.ok ? animals.rows.filter((row) => !["sold", "dead"].includes(String(row.status || "").toLowerCase())) : [];
  const healthRows = health.ok ? health.rows.filter((row) => Boolean(row.next_due)) : [];
  const machineryRows = machinery.ok ? machinery.rows.filter((row) => !["completed", "cancelled", "rejected"].includes(String(row.status || "").toLowerCase())) : [];
  const demandRows = demands.ok ? demands.rows.filter((row) => !["completed", "cancelled", "rejected"].includes(String(row.status || "").toLowerCase())) : [];
  if (!animals.ok) notes.push(animals.message);
  if (!health.ok) notes.push(health.message);
  if (!machinery.ok) notes.push(machinery.message);
  if (!demands.ok) notes.push(demands.message);
  return { farmers: count(farmers), farms: count(farms), crops: count(crops), animals: animals.ok ? animalRows.length : null, vetOpen: health.ok ? healthRows.length : null, machineryOpen: machinery.ok ? machineryRows.length : null, demandsOpen: demands.ok ? demandRows.length : null, notes: [...new Set(notes)] };
}
