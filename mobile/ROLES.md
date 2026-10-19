# Mobile app — role-based experience (Farmer / Customer / Sales staff)

Owner approved design: 19 Oct 2026 (`/workspace/screens/mobile_roles_20261019/overview_*.png`).

## Login ke baad routing
1. `profiles` row (active) parhi jati hai.
2. `fn_mobile_whoami()` (migration 605) → `kind`: `staff` | `farmer` | `customer` | `none`.
   605 live na ho to purana `profiles.role` mapping (fallback).
3. `RoleHome`: farmer → `FarmerShell`, customer/supplier → `CustomerShell`, staff/admin → `StaffShell`, dealer → purana `RoleDashboard`.
UI sirf rasta chunti hai; har RPC server par role + branch dobara jaanchti hai.

## Screens
| Role | Screens | Backend |
|---|---|---|
| Farmer | Home (hero, KPI, tiles, Kisan AI), Dairy (Doodh ki Farokht, Maweshi Loan), Kheet/Faslein, Wallet/Khata, Bills, Season Plan (Gandum/Munji), Product Demand (pehle qism), All Services | `farmers` own row (RLS), 586 `mobile_my_summary`, 565 khata, `fn_my_bills`, `fn_my_milk_collection`, `farmer_product_demands` insert (RLS own, 604 categories) |
| Customer | Home + khata card, nav Home · Khata · + · Orders · Profile | 565 khata, 572 `fn_my_*`, orders |
| Sales staff | Home summary, Parties/Recovery (search, filters, masked phones), Party view, + Entry sheet, Kaam | 605 `fn_staff_home_summary`, `fn_staff_party_search`, `fn_staff_party_view`; 606 `fn_staff_submit_entry`, `fn_staff_my_entries` |

Removed per owner: Fertilizer Credit, Livestock. No udhaar checkout. WhatsApp: preview → staff Confirm → WhatsApp khulta hai (staff khud Send dabata hai); kuch auto nahi jata.
Maweshi loan request, season booking, payment claim/promise abhi website portal kholte hain (in-app form baad mein).

## Demo
Bina Supabase keys ke: login par Farmer / Customer / Staff / Admin buttons; app bar mein ⇄ se role badlein. Sab namoona data ("Demo …").
