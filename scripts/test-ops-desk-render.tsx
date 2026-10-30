/** Server-render the ops desk and payroll views with fixture rows. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const nodeRequire = createRequire(__filename);
const reactDom = nodeRequire("react-dom") as {
  useFormState?: (action: unknown, initial: unknown) => [unknown, () => void];
  useFormStatus?: () => { pending: boolean };
};
reactDom.useFormState = (_action, initial) => {
  const [state] = React.useState(initial);
  return [state, () => {}];
};
reactDom.useFormStatus = () => ({ pending: false });

async function main() {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { OpsBoard } = await import("../src/app/admin/finance/ops/ops-board");
  const { PayrollCards, PayrollSwitch, PayrollTx } = await import("../src/app/admin/hr/payroll/payroll-views");

  const ops = renderToStaticMarkup(
    React.createElement(OpsBoard, {
      model: {
        monthLabel: "October 2026",
        monthPrefix: "2026-10",
        cards: [
          {
            key: "route",
            title: "Route ka tel",
            titleUr: "روٹ کا تیل",
            blurb: "Motorcycle fuel logs",
            amount: 12500,
            pending: 1,
            lines: [{ label: "Manzoor", amount: 12500 }],
            href: "/admin/milk-collection/fuel",
          },
          {
            key: "diesel",
            title: "Diesel",
            titleUr: "ڈیزل",
            blurb: "Generator + company",
            amount: null,
            pending: null,
            lines: [
              { label: "Generator", amount: 4000 },
              { label: "Machine (company)", amount: null },
            ],
            href: "/admin/milk-collection/generator",
          },
          {
            key: "maint",
            title: "Gaari ki marammat",
            titleUr: "گاڑی کی مرمت",
            blurb: "Maintenance",
            amount: 0,
            pending: 0,
            lines: [{ label: "Manzoor", amount: 0 }],
            href: "/admin/milk-collection/maintenance",
          },
        ],
        queue: [
          {
            id: "f1",
            source: "route_fuel",
            title: "Route ka tel",
            who: "Ali Raza",
            asset: "CD 70",
            amount: 2500,
            date: "2026-10-28",
            statusLabel: "Manzoori baqi",
            anomaly: false,
            review: { kind: "approve_fuel" },
            href: "/admin/milk-collection/fuel",
          },
          {
            id: "f2",
            source: "route_fuel",
            title: "Route ka tel",
            who: "Manager",
            asset: "Apni bike",
            amount: 800,
            date: "2026-10-27",
            statusLabel: "Manzoori baqi",
            anomaly: true,
            review: { kind: "held", reason: "self" },
            href: "/admin/milk-collection/fuel",
          },
        ],
        movements: [
          { id: "m1", title: "Generator diesel", detail: "Sara · Chiller", amount: 1800, date: "2026-10-20", statusLabel: "Manzoor" },
        ],
        payroll: { read: true, status: "draft", staff: 2, payable: 40000, href: "/admin/hr/payroll?m=2026-10&view=cards" },
        notes: ["Machine diesel parha nahi gaya."],
      },
    })
  );

  assert.match(ops, /AgriBridge/);
  assert.doesNotMatch(ops, /Kisan ka Wasela|Kisan ka wasila/i);
  assert.match(ops, /Route ka tel/);
  assert.match(ops, /Ali Raza/);
  assert.match(ops, /name="approval_comment"/);
  assert.match(ops, /Manzoor/);
  assert.match(ops, /Apni entry/);
  assert.match(ops, /parha nahi gaya/);
  assert.match(ops, /Rs 0/);
  assert.doesNotMatch(ops, /JazzCash|Alfalah|Petty/i);

  const cards = renderToStaticMarkup(
    React.createElement(PayrollCards, {
      status: "draft",
      lines: [{ id: "l1", name: "Noor Fatima", designation: "Helper", net: 18000, present_days: 20, advance_deduction: 0, attendance_finalized: true, open_items: 0, absent_days: 0, unpaid_leave_days: 0, missing_days: 0, half_days: 0 }],
    })
  );
  const tabs = renderToStaticMarkup(React.createElement(PayrollSwitch, { year: 2026, month: 10, branch: null, view: "cards" }));
  const tx = renderToStaticMarkup(
    React.createElement(PayrollTx, {
      year: 2026,
      month: 10,
      runStatus: "paid",
      payable: 18000,
      runRead: true,
      advances: null,
      adjustments: [],
    })
  );
  assert.match(cards, /Noor Fatima/);
  assert.match(cards, /Draft/);
  assert.match(tabs, /payroll-view-cards/);
  assert.match(tabs, /Harkatein/);
  assert.match(tx, /Advance parhe nahi gaye/);
  assert.match(tx, /Tankhwah ada/);

  mkdirSync("/tmp/ops-desk-preview", { recursive: true });
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>Tel aur ops</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@3.4.17/dist/tailwind.min.css" />
</head><body class="bg-[#0b1324] p-6">${ops}<div class="mt-8 bg-white p-4 text-slate-900">${tabs}${cards}${tx}</div></body></html>`;
  writeFileSync("/tmp/ops-desk-preview/index.html", page);
  console.log("rendered ops desk and payroll views");
}

main();
