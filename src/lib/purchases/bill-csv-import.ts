import { parseDelimited } from "@/lib/csv";
import { billCsvDate } from "./bill-csv-date";
import { matchBillProduct, normalizeBillProduct, parseBillNumber, purchaseLineTotal } from "./bill-math";

const aliases = {
  code: ["code", "product code", "item code", "sku", "sku code"],
  product: ["product", "product name", "item", "item name", "name", "naam", "cheez"],
  pack: ["pack", "pack size", "pack/quanti", "pack/quenti", "pack/quantity", "unit", "size"],
  qty: ["qty", "quantity", "tadad", "stock", "quantity bottles", "bottle quantity", "quantity packs", "pack quantity"],
  purchase: ["purchase rate", "purchase price", "trade rate", "trade", "cost", "lagat", "trade rate pack", "trade rate per pack", "purchase rate pack"],
  sale: ["sale rate", "sale price", "selling rate", "selling price", "retail", "retail rate", "retail rate bottle", "retail rate botal", "retail rate per bottle", "sale rate bottle", "sale rate per bottle", "sale rate item", "retail price", "s rate", "s.rate"],
  wholesale: ["wholesale", "wholesale rate", "wholesale price", "thok", "thok rate", "wholesale rate pack", "wholesale rate per pack", "wholesale rate bottle", "w rate", "w.rate"],
  mrp: ["mrp", "mrp rate", "mrp price", "printed price", "mrp rate bottle", "mrp per bottle", "mrp rate per bottle", "retail mrp"],
  expiry: ["expiry", "expiry date", "expiration date", "exp date"],
  batch: ["batch", "batch no", "batch number"],
  manufacture: ["manufacture date", "manufacturing date", "mfg date"],
  company: ["company", "company name", "brand", "manufacturer", "make"],
  category: ["category", "product category", "item category"],
  group: ["stock group", "group", "department", "type"],
  amount: ["amount", "line total", "total amount", "total"],
} as const;
type Master = { id: string; name: string; product_code?: string | null; pack_size?: string | null; unit?: string | null; units_per_pack?: number | null };
export type BillCsvRow = {
  sourceRow: number; sourceCode: string; systemCode: string; name: string; product_id: string; quantity: string; unit_cost: string;
  sale_rate: string; wholesale_rate: string; mrp_rate: string; expiry_date: string;
  manufacture_date: string; batch_number: string; units_per_pack_override: string;
  pack_override: string; sourceQuantity: string; sourcePack: string; lineTotal: number | null;
  source_pack: string; source_company: string; source_category: string; source_group: string;
};

/** Explicit pack-rate files use NxU as pack count × bottles/pack, never a product size. */
export function importBillCsv(text: string, products: Master[]) {
  const table = parseDelimited(text);
  const errors: string[] = [], warnings: string[] = [];
  const rows: BillCsvRow[] = [];
  if (table.length < 2) return { rows, errors: ["CSV mein heading aur product lines honi chahiye."], warnings };
  const headers = table[0].map(h => h.trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," "));
  const col = (key: keyof typeof aliases) => headers.findIndex(h => (aliases[key] as readonly string[]).includes(h));
  if (col("product") < 0 || col("qty") < 0 || col("purchase") < 0) {
    return { rows, errors: ["Product Name, Quantity aur Trade Rate / Trade Rate Pack columns chahiye."], warnings };
  }
  const names = new Map<string, number>();
  for (const [index, cells] of table.slice(1).entries()) {
    const sourceRow = index + 2;
    const get = (key: keyof typeof aliases) => { const i = col(key); return i < 0 ? "" : String(cells[i] ?? "").trim(); };
    const name = get("product");
    const sourceCode = get("code");
    if (!name) { errors.push(`CSV row ${sourceRow}: product name khali hai.`); continue; }
    const pack = get("pack");
    const expression = /^(\d+)\s*[×xX*]\s*(\d+)$/.exec(pack);
    const packs = expression ? Number(expression[1]) : null;
    const units = expression ? Number(expression[2]) : null;
    const qtyHeader = headers[col("qty")];
    const packRate = headers[col("purchase")].includes("pack");
    const bottleMode = qtyHeader.includes("bottle") || (packRate && !qtyHeader.includes("pack") && Boolean(expression));
    let quantity = parseBillNumber(get("qty"));
    if (bottleMode) {
      if (!units || !packs || quantity !== packs * units) errors.push(`CSV row ${sourceRow}: Quantity ko Pack (${pack}) ki bottle ginti se milayein.`);
      quantity = units && quantity !== null ? quantity / units : null;
    }
    const unit_cost = get("purchase");
    const lineTotal = purchaseLineTotal(quantity, unit_cost);
    if (lineTotal === null) errors.push(`CSV row ${sourceRow}: quantity/trade rate durust likhein.`);
    const amount = parseBillNumber(get("amount"));
    if (get("amount") && (amount === null || lineTotal === null || Math.abs(amount - lineTotal) > 0.01)) warnings.push(`CSV row ${sourceRow}: Amount se calculated total nahi milta; quantity × rate use hoga.`);
    const key = normalizeBillProduct(name);
    if (names.has(key)) warnings.push(`CSV rows ${names.get(key)} aur ${sourceRow}: ${name} dobara hai; product aur pack verify karein.`);
    else names.set(key, sourceRow);
    let product = matchBillProduct(products, name, expression && packRate ? "" : pack, sourceCode);
    if (sourceCode && product && normalizeBillProduct(product.product_code ?? "") !== normalizeBillProduct(sourceCode)) {
      warnings.push(`CSV row ${sourceRow}: code ${sourceCode} Product Master mein nahi mila; name/pack se ${product.name} link hua.`);
    }
    if (product && units && product.units_per_pack && product.units_per_pack > 1 && units !== product.units_per_pack) {
      warnings.push(`CSV row ${sourceRow}: ${name} ke master pack mein ${product.units_per_pack} items hain, CSV mein ${units}; pehle sahi product/pack chunein.`);
      product = null;
    }
    if (!product) warnings.push(`CSV row ${sourceRow}: ${name} ko existing Product Master se link karein. Naya product khud se nahi banega.`);
    for (const dateKey of ["expiry", "manufacture"] as const) if (get(dateKey) && !billCsvDate(get(dateKey))) errors.push(`CSV row ${sourceRow}: ${dateKey} date DD-MM-YYYY ya YYYY-MM-DD mein likhein.`);
    for (const rateKey of ["sale", "wholesale", "mrp"] as const) if (get(rateKey) && parseBillNumber(get(rateKey)) === null) errors.push(`CSV row ${sourceRow}: ${rateKey} rate invalid hai.`);
    const numeric = (key: "sale" | "wholesale" | "mrp") => get(key) ? String(parseBillNumber(get(key)) ?? get(key)) : "";
    rows.push({ sourceRow, sourceCode, systemCode: product?.product_code ?? "", name, product_id: product?.id ?? "", quantity: quantity === null ? get("qty") : String(quantity),
      unit_cost: String(parseBillNumber(unit_cost) ?? unit_cost), sale_rate: numeric("sale"), wholesale_rate: numeric("wholesale"), mrp_rate: numeric("mrp"),
      expiry_date: billCsvDate(get("expiry")), manufacture_date: billCsvDate(get("manufacture")), batch_number: get("batch"),
      units_per_pack_override: packRate && units ? String(units) : "", pack_override: product?.pack_size ?? product?.unit ?? (expression && packRate ? "" : pack),
      sourceQuantity: get("qty"), sourcePack: pack, lineTotal,
      source_pack: pack, source_company: get("company"), source_category: get("category"), source_group: get("group") });
  }
  return { rows, errors, warnings };
}
