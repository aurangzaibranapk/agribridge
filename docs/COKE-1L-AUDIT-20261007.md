# Coke 1L statement audit — 7 October 2026

Product: d58a50b6-f2ea-42f2-8735-457c3635a2ee. Product pack: 6 units/pack.
Read-only live database inspection; no stock, purchase or ledger data changed.

## Verified current totals

| Location | Movement in | Movement out | Net | Inventory | Remaining batches |
|---|---:|---:|---:|---:|---:|
| Kisan Karyana Mahabali - Godam | 742 | 740 | 2 | 2 | 2 |
| Company HQ — Head Quarter Warehouse | 776 | 668 | 108 | 108 | 108 |
| Total | 1,518 | 1,408 | 110 | 110 | 110 |

The gross movement totals include adjustments and their reversals. They are not purchase/sales totals. POS source items show 24 bottles sold in 22 lines; stock sale movements also show 24. One return item totals 2 bottles, matching return-in movements.

## Findings and actions

1. **False pending warning:** original Karyana correction d358cfef-b64c-4dc7-8f8b-c0b28bc8bcf9 added 310 on 2 October. Reversal d43aff3e-b8c1-4147-b98e-7e0e38e3172a removed 310 on 4 October and explicitly identifies the original ID in its note. Net zero. Do not reverse it again. UI now recognises explicit source-linked equal-quantity reversals and retains both history rows.
2. **HQ correction still needs historical evidence:** a8ab03e0-96d7-4ca7-abd6-64e3a1f1391b added 386 on 2 October. Later e27d5933-a13f-41f3-a576-1810211f7acc removed 410 on 6 October with a note about repeated six-pack conversion and a duplicate 50-unit GRN increase. Different amounts and no explicit original source link: do not assume these are a matched reversal pair. Current quantities reconcile, but that alone does not prove every historic correction.
3. **Pack/unit inconsistency in historic purchase records:** bill jx0032464 stores purchase quantity 10, received 10, rate 717.06, total 7,170.60; its batch initial/remaining quantity is 60 bottles. The HQ purchase movement is 10 and a later +50 GRN adjustment exists. This is consistent with ten six-packs converted through an adjustment instead of one consistently normalised receipt. Verify the original invoice/GRN unit before rewriting history.
4. **Old Karyana batch metadata differs from purchase units:** JX0098807 purchase quantity/received quantity is 60, while batch PO-1789046284084-d58a50b6 initial quantity is 360 and remaining quantity is 2. Current stock matches; original invoice/GRN is required to determine whether 60 meant packs or bottles. Do not automatically reduce or multiply stock again.
5. **Warehouse balances looked contradictory:** each statement row is a balance for its own location. HQ 108 plus Karyana 2 equals total 110. Column renamed Location Balance.
6. **Correction candidates appear above newer sales:** the page deliberately prioritises warnings rather than a pure date order; historical row balance is not today's overall stock. Reversed correction is no longer prioritised as pending.
7. **Completeness risk:** old page requested a single capped movement list and ignored movement errors. Updated loading pages the complete movement history with stable ordering, fails on query errors, and chunks linked source lookups. AI review uses all loaded movements, not just selected/date-filtered visible rows, and includes filters separately.

## AI review button

Every product statement includes “AI se statement check karayein”. It opens the existing AI panel and submits product, full movement history, inventory, remaining batches, purchase lines, POS lines, return lines, available source documents, totals, location balances and reversal evidence. It uses the existing AI service. Statement review disables action tools; follow-up audit questions retain the record context and remain read-only until navigation. An AI/key/network failure is reported in the panel, not treated as a verified statement.

The report can identify evidence and suggest a repair. It does not silently change stock or financial records. Original invoices, missing source documents and physical counts remain necessary where historic units cannot be proved.

## Validation

- Live read-only totals, batches, purchase lines, POS quantities and return quantities checked.
- Regression checks distinguish the proven 310 reversal from equal amounts without source proof, wrong warehouse, wrong direction and the unrelated 410 correction.
- TypeScript and production build checked before push.
- cPanel deployment and browser/printer testing are separate pending steps.
