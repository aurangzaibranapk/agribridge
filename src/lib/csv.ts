/**
 * Chhota CSV/TSV parser, bahar ki library ke baghair.
 *
 * Do jagah se bulaya jata hai -- products ka import (241) aur bill se
 * trade rate (251) -- is liye yahan rakha gaya hai. Do naqlein banane
 * se ek din ek jagah theek hoti hai aur doosri wahin ki wahin reh jati
 * hai.
 *
 * Quote ke andar comma aur nayi lakeer dono chalti hain -- ye wo do
 * cheezein hain jin par saada `split(",")` toot jata hai, aur us tootne
 * ka pata tab chalta hai jab qeemat ka khana naam mein chala gaya ho.
 */
export function parseDelimited(text: string): string[][] {

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  // Excel se khane COPY karne par wo TAB se alag hote hain, comma se
  // nahi. Bina is ke banda Excel se copy kar ke paste karta hai aur
  // poori qatar ek hi khane mein chali jati hai -- aur us ka pata
  // "naam ka khana nahi mila" jaise paighaam se chalta hai, jo asal
  // masla batata hi nahi.
  //
  // Faisla pehli lakeer se hota hai: jis nishan ki ginti zyada, wohi
  // us file ka nishan hai.
  const firstLine = src.split("\n")[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const sep = tabs > commas ? "\t" : ",";

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
