# AgriBridge mobile business coverage (Testing)

The mobile app is one role-aware client of the existing ERP. It must never create a second customer, farmer, booking or cash ledger when the ERP already owns that record. An enquiry and a confirmed transaction are separate events.

## Role-based home

| Role | Home | Data boundary |
| --- | --- | --- |
| Farmer — Digital Munshi | Combined khata, milk, shop purchases, machinery, grain and service requests | Own farmer identity and linked customer record only |
| Staff — Office Book | Assigned branch/shop work, collection, stock, requests and approvals | ERP feature permissions and branch/shop scope |
| Admin — Office Admin | Business summaries, service requests, exceptions and approvals | Organization and delegated access |

Use the existing green AgriBridge theme, short labels, a bottom navigation bar, readable cards, and a prominent primary action. Each amount must state whose balance it is. Show empty, loading and error states. Never display demo amounts in a logged-in account.

## Business and source of truth

| Business | Farmer sees | Staff/Admin action | ERP source |
| --- | --- | --- | --- |
| Milk & dairy | Litres, quality, milk payment and balance | Collection, verification, dispatch and payment | `milk_entries`, `milk_payments`, milk ledger |
| Kisan dukaan & karyana | Products, purchases, credit and receipts | Existing POS and shop processes | `pos_sales`, `pos_sale_items`, customer/farmer khata |
| Machinery | Request, confirmed booking, work, diesel and balance | Booking, vendor, payment and diesel in one booking workflow | `machinery_bookings`, `machinery_payments`, `machinery_fuel_logs`, work records |
| Grain/procurement | Sale request, weighment, cuts and payment | Procurement entry, verification and payout | `grain_procurement_entries`, `grain_procurement_payments` |
| Vets | Service request, appointment and outcome | Assign and complete the service | Request workflow until ERP service records exist |
| Other farmer services | Crop doctor request and status | Review and respond | `mobile_service_requests` |

## Delivery state

- Flutter app: role-aware sign-in, farmer summary/khata, catalog and order screens, notifications and request submission exist in code.
- This change: admin request inbox with status updates; farmer request history shows all requests and current status. Testing database has the request table and scoped RLS.
- ERP booking, payment, diesel, milk, grain and shop ledgers are **not yet connected** to this mobile build. A status such as “scheduled” on an enquiry must not be represented as a confirmed machinery booking.
- The other mobile foundation RPCs/tables from migrations 377–381 have not been deployed to Testing. Those migrations need a schema compatibility pass because the current ERP database has evolved; in particular `shop_inventory` is absent.

## Next implementation sequence

1. Replace the mobile farmer summary RPC with a read-only, identity-scoped combined khata using the current ERP schema. Reconcile it against the web statement.
2. Link machinery requests to the canonical booking ID, then add booking detail, payment and diesel views backed by existing ERP operations. No duplicate financial writes.
3. Add milk, karyana and procurement statements from their canonical records. Handle a farmer linked to a customer through the existing identity mapping.
4. Build a permission-scoped staff task desk and admin business view from ERP data. Add vets workflow when the ERP record and access rules are defined.
5. Verify on Testing with farmer, staff and admin accounts, Flutter CI, Android APK, transaction reconciliation and permission checks before release.
