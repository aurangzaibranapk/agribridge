/** Certificate form aur print sheet ka pehla render. */
import assert from "node:assert/strict";
import React from "react";
import { createRequire } from "node:module";

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
  const { HandoverForm } = await import("../src/app/admin/milk-collection/handover/handover-form");
  const { CertificateSheet } = await import("../src/components/milk/certificate-sheet");

const html = renderToStaticMarkup(
  React.createElement(HandoverForm, {
    lang: "rm",
    branches: [{ id: "b1", name: "Main Branch Mahabali" }],
    shops: [{ id: "s1", name: "Kisaan Milk Center", code: "02", branchId: "b1" }],
    specs: { minFat: 4.1, minLr: 27, minSnf: 8.4 },
    formula: { snfConstant: 0.805, referenceTs: 13 },
    myName: "Collector",
    locked: false,
    priorGross: null,
    hadLines: true,
    dispatchId: null,
    defaults: {
      branchId: "b1",
      shopId: "s1",
      date: "2026-10-30",
      shift: "morning",
      time: "06:30",
      mccName: "Kisaan Milk Center",
      vehicle: "",
      driver: "",
      notes: "",
      accepted: "",
      rejectionReason: "",
      licenseeRep: "",
      licenseeSignature: "",
      collectorSignature: "",
      lines: [
        {
          chillerNo: "1",
          milkType: "Cow",
          grossL: "100",
          fat: "3.8",
          lr: "26",
          snf: "8.1",
          adjustedL: "",
          temperatureC: "4",
          organo: "Normal",
        },
      ],
    },
  })
);

assert.match(html, /Milk Handover Certificate/);
assert.match(html, /Chiller No\./);
assert.match(html, /Gross Vol/);
assert.match(html, /Adjusted Volume/);
assert.match(html, /Min Specs/);
assert.match(html, /Kisan Pakistan/);
assert.match(html, /FAT 3\.8 — min 4\.1/);
assert.match(html, /value="3\.8"/);
assert.match(html, /value="91\.54"/);
assert.match(html, /company agreement 20°C/);
assert.match(html, /22°C — vendor/);
assert.match(html, /name="lr_baseline" value="20"/);
assert.doesNotMatch(html, /Likhein/);
assert.doesNotMatch(html, /Kisan ka Wasela|کسان کا وسیلہ/);
assert.equal(html.includes('name="lines_json"'), true);

const vendorHtml = renderToStaticMarkup(
  React.createElement(HandoverForm, {
    lang: "rm",
    branches: [{ id: "b1", name: "Main Branch Mahabali" }],
    shops: [],
    specs: { minFat: 4.1, minLr: 27, minSnf: 8.4 },
    formula: null,
    myName: "",
    locked: false,
    priorGross: null,
    hadLines: true,
    dispatchId: null,
    defaults: {
      branchId: "b1",
      shopId: "",
      date: "2026-10-30",
      shift: "morning",
      time: "",
      mccName: "",
      vehicle: "",
      driver: "",
      notes: "",
      accepted: "",
      rejectionReason: "",
      licenseeRep: "",
      licenseeSignature: "",
      collectorSignature: "",
      lrBaseline: 22,
      lines: [{
        chillerNo: "1",
        milkType: "Cow",
        grossL: "100",
        fat: "4",
        lr: "24",
        snf: "",
        adjustedL: "",
        temperatureC: "32",
        organo: "",
      }],
    },
  })
);
assert.match(vendorHtml, /value="8\.36"/);
assert.match(vendorHtml, /value="95\.08"/);
assert.match(vendorHtml, /vendor 22°C: 24\+3=27/);
assert.match(vendorHtml, /name="lr_baseline" value="22"/);

const sheet = renderToStaticMarkup(
  React.createElement(CertificateSheet, {
    cert: {
      mccName: "Kisaan Milk Center",
      date: "2026-10-30",
      time: "06:30",
      shiftLabel: "Subah",
      lines: [
        {
          chillerNo: "1",
          milkType: "Cow",
          grossL: 100,
          fat: 4.2,
          lr: 24,
          snf: 8.5,
          ts: 12.7,
          adjustedL: null,
          temperatureC: 32,
          organo: "Normal",
          flags: [],
        },
      ],
      grossTotal: 100,
      adjustedTotal: null,
      accepted: null,
      rejectionReason: null,
      licenseeRep: null,
      licenseeSignature: null,
      collectorSignature: null,
      vehicle: null,
      driver: null,
      specs: { minFat: 4.1, minLr: 27, minSnf: 8.4 },
      flags: [],
      lrBaseline: 20,
    },
  })
);
assert.match(sheet, /Kisaan Milk Center/);
assert.match(sheet, /faisla baqi/);
assert.match(sheet, /4\.1/);
assert.match(sheet, /LR recipe: company agreement 20°C/);
assert.match(sheet, /raw 24 \+4/);
assert.doesNotMatch(sheet, /Kisan ka Wasela|کسان کا وسیلہ/);

const { CertificatePrintBar } = await import("../src/app/admin/milk-collection/handover/print-bar");
const bar = renderToStaticMarkup(
  React.createElement(CertificatePrintBar, {
    lang: "rm",
    editHref: "/admin/milk-collection/handover/x",
    shareText: "Kisan Pakistan\nMilk Handover Certificate",
    emailSubject: "Kisan Pakistan — Milk Handover Certificate",
  })
);
assert.match(bar, /data-testid="handover-print"/);
assert.match(bar, /data-testid="handover-whatsapp"/);
assert.match(bar, /data-testid="handover-email"/);

  console.log("milk-handover render: ok");
}

main();
