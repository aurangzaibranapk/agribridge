/** Chiller total form pehle render par phone digits dikhata hai. */
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
  const { ChillerTotalForm } = await import("../src/app/admin/milk-collection/chiller/total-form");
  const html = renderToStaticMarkup(
    React.createElement(ChillerTotalForm, {
      lang: "rm",
      branchId: "b1",
      date: "2026-10-31",
      shift: "morning",
      chillerNo: "Mahabali",
      grossL: "1",
      fat: "4.3",
      lr: "27",
      snfConstant: 0.806,
      referenceTs: 13,
      ready: true,
    })
  );
  assert.match(html, /data-testid="chiller-no-label"/);
  assert.match(html, /Mahabali/);
  assert.match(html, /Chiller number badlein/);
  assert.equal((html.match(/data-testid="chiller-no-input"/g) ?? []).length, 0);
  assert.match(html, /8\.416/);
  assert.match(html, /12\.717/);
  assert.match(html, /0\.979/);
  assert.match(html, /1\.027/);
  assert.doesNotMatch(html, /wasila/i);
  console.log("milk-chiller-total-render ok");
}

main();
