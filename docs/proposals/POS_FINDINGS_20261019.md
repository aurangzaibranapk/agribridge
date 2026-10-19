# POS findings -- Kisaan Karyana Mahabali, 15-19 Oct 2026

Read-only check on live (ktskwawkslaznkjjacni), 19 Oct 2026. Code fix on branch `fix/pos-card-cash-dupes`.

## 1. Waseela Card saved as cash
- `posCheckout` sent `p_cash_paid = all non-khata lines`. So a Rs 230 Waseela Card bill (3C711691) stored `cash_paid = 230`.
- Correct already: `pos_sale_payment_details`, the cash book, the ledger (`post_pos_source`) and shift Expected Cash all read the per-method rows.
- Inflated: Sales Report "Naqad aaya" and the per-shop naqad column, Meri Dukan "Naqad aaya", `get_daily_sales_summary.cash_total`, and the receipt "Cash Paid" line when a bill has no detail rows.
- Live: 29 Mahabali bills, overstated by Rs 11,815 (18 Sep to 18 Oct). Plus 2 old bills (Rs 30).
- Fix: `p_cash_paid = cash lines only`. The two sales reports now read cash from the detail rows, with a fallback to `cash_paid` for bills with no detail rows.
- History: `pos_card_as_cash_correction_20261019.sql`. Part A is a read-only report; Part B is the correction, commented out and not run.

## 2. Double bill (Mujahid Abbas Rs 230, 0516B948 / 405AB0F2)
- 16 Oct 2026, 19:24:02 and 19:24:26 PKT: 24 seconds apart, same customer, item and price. Both have `client_action_id = NULL`.
- The DB guard already exists: unique index `idx_pos_sales_client_action` (migration 504), plus idempotent `create_pos_sale`. The online POS never sent a key; only offline sync did.
- Fix (no migration needed, so 581-589 are still free):
  - The button gate locks at once, so a double tap only checks out once.
  - Each cart gets one `clientActionId`, reused on retry and cleared after success.
  - The server replays an existing key and returns the first bill.
  - If the same staff makes the same bill (customer + total + items) within 120 s, the server asks before saving. Staff must press OK on the "Kya ye naya bill hai?" confirm.
- Offline sync skips the 120 s question, because it relies on its own key.

## 3. Shift SHIFT-26-00019 (13-16 Oct): cash sale Rs 1,870 vs expected Rs 370
- The formula is correct. The difference is **Rs 1,500 of "Naqad udhaar" paid out of the cash box** in 6 entries on 16 Oct, between 19:29 and 19:40 PKT. All are to Aurangzaib: 100 + 100 + 100 + 100 (g) + 1,000 ("hasnan la gya") + 100 (shahzad).
- 0 opening + 1,870 cash - 1,500 = 370 = counted. Easypaisa 220 and Waseela 230 were correctly left out.
- SHIFT-26-00022 (18 Oct) works the same way: 730 + 220 - 500 (Mujahid, "uasman") - 200 (Aurangzaib, sabun) = 250.
- The shift slip already shows the "Cash udhaar diya" line. No code bug was found. The numbers are pinned in a test.

## 4. Unit labels
- Proposal: `product_unit_fixes_mahabali_20261019.sql`. It covers 140 products: 31 btl, 2 can, 79 pkt and 28 pcs. It ends in ROLLBACK and has not been run.
- The pkt/pcs guesses for items with a blank unit need a shop check.

## 5. Invoice number
- `pos_sales` has **no** invoice / bill number column. The receipt number is the first 8 characters of the sale UUID (e.g. 3C711691), and returns look it up with `ilike`.
- Option for later (not built): an additive `invoice_no` per shop and year (e.g. `KKM-26-000123`), filled by a sequence in `create_pos_sale`. That needs a migration (581+) and owner approval.
