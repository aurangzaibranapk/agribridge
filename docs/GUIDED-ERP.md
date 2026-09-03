# AgriBridge Guided ERP — malik ka naqsha, aur is ki asal halat

Malik ka usool (2 September 2026):

> "Har kaam ke liye ek seedha raasta, AI har step par guide kare, aur
> har department sirf apna relevant kaam dekhe."
>
> Naam: **AgriBridge Guided ERP**. AI ka hissa: **AgriBridge Work Coach**.
> Goal: *Ask what to do → AI guides you → You verify → System records.*

Ye file malik ke 16 nukton ko system ki asal halat se milati hai. Har
qatar ka darja teen mein se ek hai: ✅ bana hua, 🟡 adha, ❌ baqi.
"Adha" ka matlab: kuch hissa hai magar us nukte ka maqsad poora nahi
hota.

---

## 1. Solah nukte, ek ek kar ke

| # | Malik ka nukta | Halat | Aaj kya hai, kya nahi |
|---|---|---|---|
| 1 | Staff ko sirf "My Work" dikhe, poora sidebar nahi | ✅ (B) | 250 ke baad staff ko sidebar nahi milti; ghar "Mera Kaam" hai; department dashboards role se bante hain. **Magar "Aaj ka Kaam" ki fehrist department-war nahi** (Purchase Staff → New Purchase, Pending Bills...). `pending-counts.ts` mein ginti hai, kaam ki fehrist nahi |
| 2 | "Aaj kya karna hai?" AI box har dashboard par | ✅ (C) | Bridge AI ek alag safha hai (/admin/bridge-ai). Dashboard par box nahi; "kahan jaun" ka jawab nahi deta; safha kholne ka link nahi deta |
| 3 | Department-trained AI | ✅ (C: role/department/ijazat AI ke saamne; alag "agent" ki jagah ek coach jo jaanta hai kaun pooch raha hai) | `classifyAgent` sawal ke lafzon se 4 agent chunta hai (crop/livestock/finance/general). **Banday ke department se nahi.** Purchase/Warehouse/Shop/Admin agent hain hi nahi |
| 4 | Screenshot Help | ✅ (C: tasveer + sawal → safha pehchan → feature_help se jawab) | Gemini tasveer parhta hai (Maal Andar, bill) magar "ye safha samjhao" ka raasta nahi. Is ke liye #11 (feature ki maloomat) pehle chahiye, warna AI andaza lagayega |
| 5 | Har safhe par "?" Is Page Ko Samjhein | ✅ (266) | Har safhe ke upar daayen "? Samjhein" → side panel: maqsad, kaun, kab, aam raasta, aage kya, ghaltiyan, video, FAQ, mutalliqa safhe, AI se poochein |
| 6 | Guided / Training Mode naye banday ke liye | ✅ (D) — button highlight nahi, pehla qadam ka link hai | Kuch nahi |
| 7 | Simple vs Advanced mode | ✅ (E: purchase aur product form; baqi safhe pehle se saade) | Profile par koi mode nahi; form sab ke liye ek jaise (purchase form par 15+ khane) |
| 8 | "Next Step" har process mein | 🟡→✅ (B, purchase aur bill; agri-order par timeline pehle se) | Purchase par darja hai (manzoori baqi → manzoor → maal aa gaya), agri-order par timeline. **Ek jaisi "Agla qadam" patti kahin nahi** |
| 9 | Dashboard par "Needs Attention" | ✅ (B) | Ginti alag alag jagah: Adhoore Products (258), Due Soon (255), pending-counts. **Ek jagah, role ke hisaab se, click karne layak fehrist nahi** |
| 10 | Training documentaries | 🟡 (D: video ka khana hai, video malik banayenge; 274/275 mein qadam ba qadam guide bani — asal button roshan aur "Next") | Ye content malik banayenge (video). System mein video ka khana bhi nahi |
| 11 | Har feature ki documentation system ke andar | ✅ (266) | `feature_help` table, 33 features likhe (Inventory ke 11, purchase ka raasta, POS, CRM, cash-close, Mera Kaam, Bridge AI); baqi features Owner/Admin `/admin/platform/help` par likhte hain, kaun sa baqi hai wahin dikhta hai |
| 12 | AI ko system ka asal naqsha pata ho, user ki halat dekh kar jawab de | ✅ (C: SYSTEM_MAP + get_my_work asal ginti se) | AI ke paas naqsha nahi. "Maal aa gaya, ab kya?" par wo purchase ka darja dekh kar nahi bolta |
| 13 | AI ko pata ho kaun pooch raha hai (role-aware) | ✅ (C) | API route sirf "staff hai" dekhta hai. Role, department, ijazatein AI tak nahi jatin |
| 14 | UI ki zaban staff-dost | ✅ (E: chaar technical label badle; baqi pehle se Roman) | Roz ke safhe Roman Urdu mein (ur/en bhi). Kuch label abhi technical: "Stock Transfer", "Pending Product Edits", "Catalog Export" |
| 15 | AgriBridge Academy (module, demo, progress) | ✅ (D) | Kuch nahi |
| 16 | "System khol lo" aur system khud bata de | ✅ (A+B+C: Mera Kaam par Aaj kya baqi hai + coach) | #1 + #9 + #12 + #13 milkar yahi banta hai |

**Ginti (E ke baad):** 16 mein se 15 poore, 1 adha (#10 — video malik ke haath mein), 0 baqi. Jo bana hua hai wo
neev hai (role-based dashboards, Mera Kaam, Bridge AI ke tools,
Gemini se tasveer parhna). Guided ERP us ke upar banega.

---

## 2. Ek faisla jo sab se pehle hai: feature ki maloomat ek table mein

Malik ke 16 mein se 6 nukte (4, 5, 11, 12, 13, 15) ek hi cheez maangte
hain: **har feature ki tasdeeq-shuda maloomat system ke andar**, jo
insaan bhi parhe aur AI bhi. Wo table `feature_help` hogi:

```
feature_key       products.setup
purpose           Adhoore products ko bikri ke liye tayyar karna
who               Owner, Admin, Warehouse
when              Naya maal aane ke baad; POS par cheez na mile to
how               (qadam ba qadam, Roman Urdu; en/ur bhi)
next              Rate/barcode/tasveer poori -> Sale Ready -> POS
mistakes          Sale rate 0 likhna; naam mein pack size na likhna
video_url         (malik ki documentary)
faq               [{q, a}]
related           [products, products.labels, purchases]
```

AI ka har jawab **isi se** aayega, apne ilm se nahi. Is se #4 (screenshot
→ safha pehchan kar isi table se batana), #5 (? panel isi ko dikhata
hai), #12 (naqsha = features ka silsila jo `next` mein likha hai), #13
(role `who` se, aur banday ki asal ijazat se) sab ek jagah se chalte
hain.

Aur is ka developer rule (malik ke alfaz mein): **koi feature "poora"
tab tak nahi jab tak Code ✓ Permissions ✓ Help ✓ AI Knowledge ✓
Training Guide ✓.** Ye CLAUDE.md mein likh diya gaya hai.

---

## 3. Banane ki tarteeb

Usool wahi: jo cheez **aaj ki live karyana dukan** ko sab se pehle
aasan banaye, wo pehle. Har qadam apne aap mein poora ho, aur pichhle
par khaRa ho.

| Qadam | Kaam | Malik ke nukte | Andaza |
|---|---|---|---|
| **A** | ~~Feature ki maloomat + "?" panel~~ | ✅ **Ho gaya (266)** — `feature_help` (rm/en, ur Roman par girta hai), har safhe ke upar "? Samjhein" (sidebar wali aur bina-sidebar dono patti), 33 features ki maloomat, Owner/Admin ka editor `/admin/platform/help`, "AI se poochein" Bridge AI par sawal ke sath | 5, 11 | — |
| **B** | ~~Needs Attention + Agla Qadam~~ | ✅ **Ho gaya** — `needs-attention.ts` (16 asal ginti, service client, "—" jab na mile), Mera Kaam aur department dashboards par role ke raaston ke mutabiq; "Agla qadam" ki patti purchases ki har qatar aur bill ke safhe par | 1, 8, 9 | — |
| **C** | ~~Work Coach~~ | ✅ **Ho gaya** — `lib/ai/work-coach.ts`: AI ko role, department, khulne wale raaste, system ka naqsha, feature_help, aur aaj ki asal ginti; tools `get_my_work`, `explain_page`, `open_page`; "Aaj kya karna hai?" box Mera Kaam aur department dashboards par; screenshot (tasveer) ke sath sawal, jawab mein safhe ke link | 2, 3, 4, 12, 13, 16 | — |
| **D** | ~~Training Mode + Academy~~ | ✅ **Ho gaya (268)** — `training_modules` (8 department, qadam + demo ka safha; video ka khana malik ke liye), `staff_training_progress`; naya banda Training Mode mein: Mera Kaam par apne department ke N kaam, pehla qadam, Academy; khud band karta hai; `/admin/academy` aur `/admin/academy/team` (Owner/Admin/Manager/HR) | 6, 10, 15 | — |
| **E** | ~~Simple / Advanced + zaban~~ | ✅ **Ho gaya (268)** — `profiles.ui_mode`, upar ki patti par switch; Simple mein purchase form (batch/expiry/notes chhupe) aur product form (zarai khane, dose, safety chhupe); rok wahi. Menu ke technical label staff-dost (Maal Bhejein, Tabdeeli Manzoori, Catalogue Nikalein, Maal Aana) | 7, 14 | — |

A se C tak -- **teen din** -- "system khol lo" wala tajurba ban jata
hai. D aur E us ko naye staff aur bikri (software bechne) ke liye
tayyar karte hain.

---

## 4. Jo is naqshe se NAHI badlega

- **AI kabhi khud kuch mehfooz nahi karta.** Draft banata hai, insaan
  manzoor karta hai (Bridge AI ka pehle se usool, 259/260 mein bhi).
- **Rok database par rehti hai**, safhe par nahi (bina rate bikri nahi,
  bina manzoori receive nahi). Simple mode khane chhupata hai, rok nahi.
- **Sifar aur "hisaab nahi rakha" ek cheez nahi** -- Needs Attention
  mein bhi: jo ginti kisi ijazat ki wajah se na mile, wahan "—", 0 nahi.
- Purane safhe mitte nahi; raasta ek hota hai (jaise 265 mein).

---

## 5. Qadam F — Staff ki tajweezein (Improvements Center) — ✅ (269)

Malik ka nukta (2 September, dopahar): *"Staff ERP ko sirf use nahi
karega — staff ki feedback se ERP continuously improve bhi hoga."*

| Malik ne kaha | Bana |
|---|---|
| Staff Work Coach ko masla/tajweez bataye, AI structured draft banaye | Tool `submit_suggestion`: pehle draft (department, feature, qism, masla, behtari, tarjeeh) + milti julti purani tajweezein; staff "haan" kahe tab darj. Coach box mein 💡 button |
| Categories | new_feature, improvement, process_problem, ui_ux, bug, automation, ai_improvement, report, training_help, other |
| Unique ID, poori history | `SUG-2026-00001` (sequence), `suggestion_comments` har halat ki tabdeeli aur baat ke sath; kabhi mitta nahi |
| Admin dashboard: New / Under Review / Accepted / Planned / In Development / Implemented / Rejected / Duplicate | `/admin/improvements` — halat ke tab ginti ke sath, faisla, note, duplicate (asal ka number), implemented version + link |
| Department head apne department ki, Master Admin sab | RLS: Owner/Admin/Manager sab; baqi apni aur apne department ki (role → department) |
| Duplicate: "7 logon ne bataya", asal na mite | `duplicate_of` link, `v_suggestion_report_counts`; AI draft par milti julti purani dikhata hai |
| Status badle to staff ko paighaam; implemented par version/tareekh/link | `notifyUser` har faisle par; `implemented_version`, `implemented_at`, `related_link` |
| AI sirf capture → structure → classify → duplicate → sifarish; deploy nahi | Tool sirf table mein likhta hai (staff ki haan ke baad); halat sirf reviewer badalta hai |
| SaaS: kis feature par sab se zyada shikayat | `feature_key` + `reported_by` — har tajweez feature se juRi hai |

**Guided ERP ab:** 16 nukte + F. 15 poore, 1 adha (video), F poora.

---

## 6. Qadam G — Ijazat ki darkhwast (AI Permission & Access Request) — ✅ (270)

Malik ka usool: *"AI natural-language intent ko permission draft mein
badalta hai; authorized insaan manzoor karta hai; permission engine
lagata hai. AI kabhi RBAC, data scope, department hierarchy ya approval
bypass na kare."*

Naya parallel system nahi bana. Ijazat wahi `user_feature_permissions`
(104) hai jo `v_user_feature_access` se chalti hai aur `expires_at` par
khud khatam hoti hai. Sirf darkhwast aur us ka silsila naya hai.

| Malik ne kaha | Bana |
|---|---|
| Staff saade lafzon mein maange, technical naam yaad na rakhe | Coach tool `request_access`: feature naam/kaam se milta hai, actions lafzon se (dekhna→view, banana→create...), draft: "Aap X ka VIEW maang rahe hain, edit/approve NAHI" + abhi kya hai + kaun manzoor karega; "haan" par darkhwast |
| Draft: user, department, feature, actions, scope, wajah, miyaad, kis ne | `access_requests` (ACC-2026-00001), `ai_interpretation` mein AI ka samjha hua |
| Granular actions | Wohi 8 jo engine mein hain: view, create, edit, verify, approve, reject, export, assign |
| Department change/addign | `kind = department_assign`: sirf Owner/Admin; approve par us dashboard ke sab features par ijazat + `extra_roles` |
| Admin apne AI ko command de ("Usman ko Milk mein...") | Wohi tool, `for_user_name`; darkhwast banti hai, Admin `/admin/access-requests` par "Manzoor karein aur lagayein" dabata hai |
| High-risk AI direct na lagaye | `riskLevel()`: finance approve/verify, users/permissions/security/reversal, department assign, cross-department non-view → sirf Owner/Admin; head/manager ko dikhti bhi nahi |
| Department Head apni ceiling ke andar | Approve par `capGrant` (delegation.ts) — jo us ke paas nahi wo kat jata hai aur likha jata hai |
| Immutable audit | `access_request_events` (sirf select/insert), purani → nayi ijazat snapshot, `logAudit` |
| Temporary: today / 7d / 30d / custom / permanent, expiry par khud hat jaye | `expiryFor()` → `expires_at`; view pehle se expired ko chhoRti hai |
| Staff AI mein My Access / Request / Pending / Departments | `/admin/my-access` (har staff ko khula), coach box mein 🔑 |
| Admin AI mein Pending / Who has what / Expiring / Departments | `/admin/access-requests` ke chaar tab |

(Us waqt tak) jo NAHI tha: "excessive/conflicting access" ki khud-kar
jaanch. **Ab bani hai — section 8 (271) aur transaction-level SoD
section 10 (274).** "Kis ke paas kya" ki fehrist wahi hai; faisla phir
bhi insaan ka.

## 7. Baqi teen kaam — malik ki priority (2 September ki report ke baad)

| # | Kaam | Priority | Malik ka maqsad |
|---|---|---|---|
| 1 | Excessive / Conflicting Access detection — ✅ bana (271, 274) | **High** | Access Requests Live hone ke baad zaroori: ek hi banda Create Payment + Verify Payment + Reverse Payment sab na le le; department scope se faltu access jama na ho. Report `/admin/access-requests` mein tab, jaanch rules table se, faisla insaan ka |
| 2 | Units / Pack Sizes masters — ✅ bana (273, 274) | **Medium/High** | Bag / Bottle / Liter / Kg / Piece / Carton aur 500ml / 1L / 5L / 20kg / 50kg. Product matching aur bill extraction saaf hogi |
| 3 | Training Mode mein button highlight — ✅ bana (274, 275) | **Medium** | AI sirf "Stock par jayein" na kahe, asal Stock button highlight ho aur "Next" aage le jaye |

"100% complete" ka usool ab saat hisson ka hai (CLAUDE.md dekhein):
Feature + Permission + Help + AI Knowledge + Audit + Simple Staff
Workflow + Testing.

## 8. Priority 1 — Ijazat ka takraao (Excessive / Conflicting Access) — ✅ (271)

Malik ke controls (2 September) aur unka jawab:

| Control | Bana |
|---|---|
| Rules configurable, code mein hard-code nahi | `access_conflict_rules` (13 seeded: 11 SoD + cross-department + sensitive load); Conflicts > Qawaid par Owner/Admin severity, enforcement, duties (JSON), min_scope, threshold badal sakta hai; har tabdeeli `access_conflict_events` mein |
| Separation of Duties primary | SoD rule = duties ki fehrist [{label, features[], actions[]}]; takraao tab jab HAR duty poori ho. Misal SOD-PAY-REVERSE: create + approve/verify + finance edit (reversal ka proxy) = CRITICAL/block |
| Feature naam nahi, action + department + scope | `fn_access_conflicts`: har (feature, action) alag; role/extra_roles/user grants teeno; rule ka `min_scope` + `narrow_scope_severity` (tang scope par kam darja ya koi takraao nahi); `applies_to_departments`; `exempt_roles` (owner/super_admin/admin) |
| Severity INFO / WARNING / HIGH / CRITICAL | `severity` + `enforcement` (advise / override / block) alag alag |
| Conflicts advisory screen, AI kuch na hataye | `/admin/access-requests?tab=conflicts`: findings (open/acknowledged/overridden/resolved), duties ki table, kahan se aayi, mashwara, silsila; "Scan chalayein" sirf report. Ijazat alag karna `/admin/permissions` par insaan ka kaam |
| Pre-approval check, saaf paighaam | `previewConflicts()` = pehle/baad ka farq; DecideForm par box "Is permission se ye existing access conflict create hoga" + jumle; darkhwast banate waqt bhi `conflict_check` mehfooz |
| HIGH/CRITICAL override: wajah + approver + waqt + miyaad; block par override nahi | `decideAccessRequest`: block → radd (event `approval_blocked`); override → sirf Owner/Admin, `override_reason` lazmi, `override_by/at/expires_at`; ijazat ki miyaad = min(darkhwast, override); head ko "Approve" band |
| Migration ke baad kuch revoke nahi; pehle baseline | 271 ke aakhir mein `fn_run_access_conflict_scan('baseline')` -- sirf findings; testing par 9 mile (1 critical, 5 high, 1 warning, 2 info), kuch nahi hata |
| Head apni ceiling se bahar na kare | Head override nahi kar sakta (`canOverride` = UNRESTRICTED_ROLES); approval par `capGrant` waise hi; acknowledge sirf apne department mein |
| Har detection/resolution/override ka audit | `access_conflict_events` append-only: detected, re_detected, resolved (no_longer_detected), acknowledged, overridden, reopened, override_expired, request_checked, approval_blocked, approval_needs_master, approved_with_override, approved_with_conflict, rule_updated |
| AI: detect → explain → suggest; faisla insaan | Coach tool `check_access_conflicts` (report / ek banday / "agar ye de dein to"); `request_access` ke draft mein `access_conflicts.warnings`; jumla `explainConflict()`: "High Access Conflict: Ahmed ke paas ... already hai. ... dene se ek hi user ... kar sakega. Recommended: ..." |

Testing (sab rollback mein, testing DB): same-user conflict ✅, tang scope → warning ✅,
doosra user/doosri branch → koi takraao nahi ✅, waqti ijazat: miyaad khatam → takraao
khatam, scan resolved + events ✅, override expiry → wapas open + event ✅, CRITICAL/block
finance role par, owner exempt ✅, department-scoped rule + cross-department (3 grants) ✅,
rule off/severity/enforcement badalna ✅. TypeScript: diffConflicts/explainConflict unit test
(6 cases) ✅. Head ceiling aur approval override ka raasta code mein hai (tsc pass); end-to-end
approval test Next ke session ke baghair yahan nahi chal saka -- Live se pehle testing par
ek dafa haath se dekhna hai.

Saaf likh dein: reversal engine mein alag action nahi (ledger-reversal role se rukta hai),
is liye SOD-PAY-REVERSE mein cash book (`finance`) ka `edit` reversal ka proxy hai; rule
badalne ke qabil hai.

### 8a. Malik ke faisle (2 September, Priority 1 ki report ke baad)

**Halat: Code Complete / Testing Almost Complete. Live Accepted NAHI.** Live ka
raasta sirf backup ki tasdeeq aur Department Head ke manual test ke PASS ke
baad khulega. "Code mein hai" final testing ke barabar nahi.

1. **Baseline ke 9 takraao auto-fix nahi.** Pehle role-wise review. Jo access
   operationally zaroori hai us par documented override; jo faltu hai wo role
   se hate. **Finance ka SOD-PAY-REVERSE (critical/block) current shakl mein
   qabool nahi -- role design se alag karein, override se nahi.**
2. **Reversal proxy waqti hai.** cash book edit = reversal permanent rule nahi.
   Agli finance improvement mein "Reversal / Correct Posted Entry" ka apna
   action-feature banega, phir SOD-PAY-REVERSE us par shift hoga (false
   positives kam). Rule ki description mein "TEMPORARY PROXY" likh diya (271
   ki seed aur testing DB dono).
3. **Live abhi nahi.** P0 rule wahi: backup verified → pre-migration record →
   265–271 → verification → build → smoke test → Live accepted.

**Baseline handling (malik ki fehrist) aur role ki tajweez** -- ye tajweez hai,
role ki ijazat abhi NAHI badli; malik ke "chalao" par migration banegi:

| Takraao | Malik ka faisla | Role mein tajweez (abhi nahi lagi) |
|---|---|---|
| Finance: Create + Approve + Reverse (critical) | Role split; normal operation mein override nahi | `finance` role se `submissions` ka approve/reject hatayein (manzoori Owner/Manager ke paas) -- is se PAY-REVERSE aur PAY-CREATE-APPROVE dono khatam; reversal proxy (finance edit) rehta hai magar teeno ek sath nahi rehte |
| Finance: Create + Approve (high) | Role split behtar; emergency waqti Owner/Admin override chal sakta hai | Upar wali tabdeeli se khud hal |
| Finance: Cash Handover + Reconciliation (high) | Jahan mumkin ho alag | `finance` se `cash-handover` ka create hatayein (handover Manager/shop kare, finance sirf dekhe/export) ya reconciliation ka edit Owner ke paas |
| Finance: Bank Entry + Reconciliation (warning) | Qabool; waqtan fawaqtan review | Koi tabdeeli nahi; acknowledge + note |
| Finance: Sensitive Load (info) | Sirf info | Kuch nahi |
| HR: HR Edit + Staff Payment (high) | Payment ki manzoori alag | `hr` role se `staff-khata` ka create hatayein (adaigi finance banaye) ya staff-khata par approve ka qadam |
| Manager: Stock Count Create + Approve (high) | Approve doosri authority ko | `manager` se `stock-count` ka approve hatayein (Owner/Finance approve kare) |
| Manager: Cash Handover + Cash Close (high) | Alag checker behtar | `manager` se `cash-close` ka create hatayein (Finance close kare) ya cash-close par verify Owner ka |
| Manager: Sensitive Load (info) | Sirf info | Kuch nahi |

**Backlog (lock):** *Permission-level conflict detection + transaction-level
self-approval prevention = complete SoD protection.* Yani Ahmed ke paas Create
aur Approve dono hon tab bhi wo apni banayi hui payment khud approve na kar
sake. Yehi usool purchase (`fn_no_receive_without_approval` ke sath), stock
count, milk verify, cash handover aur returns par -- database trigger/check
`created_by <> approved_by` ki shakl mein, ta ke UI bypass na ho sake.

**Live se pehle lazmi manual test (Testing par, PASS chahiye):**

1. Kisi department head ke login se `/admin/access-requests` kholein.
2. Aisi pending darkhwast chunein jis par HIGH takraao banta ho (misal
   warehouse staff ke liye `stock-count` approve).
3. Umeed: laal/narangi box "Is permission se ye existing access conflict
   create hoga", Approve button band, paighaam "sirf Owner/Admin override".
4. Owner login se wohi darkhwast: override ki wajah ke baghair Approve →
   ruk jaye; wajah + miyaad ke sath → lag jaye, `override_by/at/expires_at`
   bhare, `access_conflict_events` mein `approved_with_override`, ijazat ki
   `expires_at` override ki miyaad se aage na ho.
5. Head ke login se Takraao tab par "Override" button nazar na aaye.

## 9. Priority 2 — Units / Pack Sizes masters — ✅ (273), aur role split (272)

**272 (role split, malik ka faisla):** finance se submissions approve/reject
aur cash-handover create hate; finance ko cash-close create mila; hr se
staff-khata create/edit hata; manager se stock-count approve aur cash-close
create hate. Testing par scan: 8 takraao khatam (resolved, no_longer_detected),
2 advisory baqi (SOD-BANK-RECON warning, SENSITIVE-LOAD info). Kisi user ki
apni ijazat nahi chhui.

**273:** `units` (28 seeded: code, label, qisam, base + factor, aliases jaise
bori/thaila/peti/dabba/adad) aur `pack_sizes` (16 seeded: 5L, 20kg, 500ml...
aliases jaise "5 ltr", "adha kilo", "ek bori"). `products.unit_code` (FK)
backfill se; purana `products.unit` text label ke liye rehta hai.
`fn_unit_code_for_text()` import/backfill ke liye.

| Jagah | Kya badla |
|---|---|
| Product Masters | do naye tab: Units, Pack Sizes (Owner/Admin/staff, `product-masters` feature) |
| Product form | unit ab master se (code), pack size par standard sizes ka datalist |
| Bill se Trade Rate, Products CSV import | matching se pehle `loadUnitAliases()` -- "DAP bori 50kg" ab "DAP 50kg Bag" se milta hai |
| product-match.ts | `registerAliases()` + `normalizePackText()`; built-in fehrist fallback |
| Help, AI | product-masters ki help, SYSTEM_MAP |

Nahi badla: intake batch form ki chhoti UNITS fehrist (Packet, Bottle...) aur
farmer portal ka unit select -- wo apni jagah theek hain; masters se jorna
baad ka kaam.

## 10. "Sara complete" — 274: transaction-level SoD, Reversal feature, Training guide

**Transaction-level SoD (backlog wala, ab bana):** `sod_transaction_rules`
(16 qawaid, badalne ke qabil) + trigger `fn_sod_no_self_approval` har us
table par (`fn_sod_attach_triggers()`): jis ne banaya wohi manzoor/tasdeeq/
receive na kare. block = exception (UI se bypass nahi); warn = chalne do,
`sod_transaction_events` mein likho; Owner/super_admin/admin exempt magar
event likha jata hai. Tables: purchases (review block, receive warn),
supplier_payment_requests, agri_order_payments, stock_counts, cash_handovers,
pos_returns, milk_entries, agri_orders (sales verify warn; finance verify,
approve block), agri_order_returns (warn), product_intake_batches (warn),
company_expense_requests, machinery_work_records, machinery_fuel_logs.

**Khabardar (Live se pehle):** jahan aaj ek hi banda banata aur manzoor
karta hai (chhoti branch), wahan block wale qadam ruk jayenge -- paighaam
saaf aata hai ("SOD: ... doosra authorized banda kare"). Rule ko 'warn'
karna ho to `sod_transaction_rules.enforcement` badlein; naya table jorna ho
to qatar daal kar `select fn_sod_attach_triggers()`.

**Reversal feature:** `finance.reversal` (is_sensitive). Role se kisi ko
nahi; Owner/Admin unrestricted; baqi darkhwast se. `ledger-reversal.ts` aur
audit-trail ab `can(access, 'finance.reversal', 'create')` dekhte hain
(pehle role list `CAN_REVERSE` -- finance bhi tha; ab nahi). SOD-PAY-REVERSE
ki teesri duty ab isi feature par -- cash book edit wala TEMPORARY PROXY
khatam.

**Training guide (priority 3):** `training_modules.guide` jsonb
[{path, target, text}]. `GuideOverlay` (admin layout, `?guide=key&step=n`)
asal button (`data-guide`) par roshan ring + card + Next/Pichhla; doosre
safhe par hon to us safhe ka link roshan aur "Wahan jayein". guide na ho to
steps ke text se raasta. Anchors: bill-upload, purchase-review,
purchase-receive. Academy card aur Training banner par "Guide ke sath
chalein"; Coach tool `start_guide`. Seed: procurement (5 qadam), warehouse
(6); baqi modules steps se chalte hain.

**Units:** intake batch form ab master ki fehrist; products par trigger
`unit_code` khud bhare (intake/import/propose sab raaste). Farmer portal ka
kg/maund/ton select waise hi (kisan ke liye teen hi kaafi).

## 11. Do chhote hisse (malik: "2 choty hisy")

- **Guide anchors sab 8 modules par** (275): pos-checkout, shop-order-submit,
  return-submit, cash-close-submit, supplier-pay, finance-add-txn,
  permissions-save, milk-verify, booking-create, transfer-request (+ pehle
  ke bill-upload, purchase-review, purchase-receive). Guides: sales 6 qadam,
  finance 6, admin_office 6, dairy 4, machinery 3, manager 5.
- **Conflicts tab par transaction-level SoD ki report**: haal ke waqiat
  (warn / exempt, kaun, kaunsa record) aur 16 qawaid; Owner/Admin wahin
  block ↔ warn aur on/off kar sakta hai (`saveSodRule`, audit event
  `sod_rule_updated`). Ruki hui (block) koshishein mehfooz nahi hotin --
  transaction wapas ho jati hai; banday ko screen par SOD ka paighaam.

## 12. Assistant + Paighaam ek panel mein (276) — malik, 3 September

Malik ne screenshot dekh kar likha: "My Work" ke upar `What do you want to
do today?` ka bada box aur neeche daayen kone ka Messages widget **do alag
tajurbe** lag rahe the. Faisla: dono ko ek panel mein milayein.

**Panel (`AssistantPanel`, admin layout par har safhe par):** teen khane
`Assistant | Paighaam | Tajaweez`. Assistant default.

- **Assistant** — wahi Work Coach (`/api/bridge-ai`): sawal, screenshot,
  aur jaldi ke kaam: Ijazat maangein · Tajweez dein · Ye safha samjhayein ·
  Training. My Work ka purana box hata diya gaya (malik ka kehna) — ab AI
  **har** safhe par hai, sirf dashboard par nahi.
- **Paighaam** — dhoondne ki patti, phir `Haal hi mein` / `Department` /
  `Staff`. Ek banday se WhatsApp jaisi baat cheet (waqt ke sath).
- **Tajaweez** — apni bheji hui tajaweez aur un ka darja; poori fehrist
  `/admin/improvements` par.

**Kis ko kya dikhta hai (`/api/messages/contacts`, server par faisla):**
Owner/Admin/Manager ko saari staff, saare department aur elaan. Aam staff
ko sirf AI, apna manager/department head, apne department ke sathi, aur jin
se pehle se baat ho rahi hai. Pehle widget seedha `profiles` se **saari**
staff utha leta tha — har naye mulazim ko poore idare ki directory nazar
aati thi.

**Elaan (sab ko paighaam):** pehle **koi bhi** login kiya hua banda "Sab
Staff Ko Bhejein" daba kar poore idare ko paighaam bhej sakta tha. Ab sirf
Owner/Admin/Manager, aur bhejne se pehle ginti ki tasdeeq: *"Ye elaan 19
mulazimeen ko bhej dein?"*. Department wala paighaam sirf usi department
ko; aam staff sirf apne department ko.

**Audit (276):** `staff_message_broadcasts` — kis ne, kab, kis daire mein
(all/department), kitnon ko, kya. `staff_messages` mein to 19 alag qatarein
banti hain; un se ye pata nahi chalta ke wo dar-asal EK elaan tha. Parhna:
apna bheja hua har koi, sab ka bheja hua sirf `fn_can_review_access()`.

**Architecture rule (malik):** UI ek jagah, **record alag** —
AI → Work Coach, insani paighaam → `staff_messages`, tajweez →
`suggestions`, ijazat → `access_requests`. Isi se audit aur ijazat saaf
rehte hain.

**Testing:** 276 ke teen DB test (department bina key ke ruke, anjaana
scope ruke, theek qatar bane) — teenon PASS, rollback. `npm run build`
saaf, tsc baseline 73 par.

**Baqi (malik ke faisle ka hissa, abhi nahi bana):** awaz (🎤) ka button,
aur department ki qatar mein poori threaded guftagu (abhi department ko
seedha paighaam bhejne ka pane hai).
