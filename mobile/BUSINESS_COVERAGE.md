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
- This change: admin request inbox with status updates; farmer request history shows all requests and current status. Staff My Work reads the signed-in staff member's orders and notifications; wider branch tasks still need ERP permission-scoped APIs. Testing database has the request table and scoped RLS.
- ERP booking, payment, diesel, milk, grain and shop ledgers are **not yet connected** to this mobile build. A status such as “scheduled” on an enquiry must not be represented as a confirmed machinery booking.
- Testing now has mobile devices, account deletion requests, the farmer summary RPC with linked shop and machinery/GL balances and activity, the request table, catalog RPC and dashboard summary RPC. These were verified with authenticated read-only test calls. Mobile order submission remains undeployed. The original 380 migration references the removed `shop_inventory` table, so the current-schema catalog/dashboard migration replaces that dependency.

Testing data check (10 Oct 2026): 20 active farmer records and 3 active customer records exist, but no customer has a farmer link, and the normalized phone comparison yielded zero candidates. The app must not infer that a customer's khata belongs to a farmer. A verified identity link is needed before that shop balance appears on the farmer's account.

## Next implementation sequence

1. Reconcile the new read-only farmer balances and activity against the web statement, including a farmer linked to a POS customer. Add grain payment and confirmed booking views without duplicating entries.
2. Link machinery requests to the canonical booking ID, then add booking detail, payment and diesel views backed by existing ERP operations. No duplicate financial writes.
3. Add milk, karyana and procurement statements from their canonical records. Handle a farmer linked to a customer through the existing identity mapping.
4. Build a permission-scoped staff task desk and admin business view from ERP data. Add vets workflow when the ERP record and access rules are defined.
5. Verify on Testing with farmer, staff and admin accounts, Flutter CI, Android APK, transaction reconciliation and permission checks before release.
