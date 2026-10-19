import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/data/mobile_providers.dart';
import '../../core/models/app_role.dart';
import '../ai/kisan_ai_screen.dart';
import '../commerce/order_history_screen.dart';
import '../farmer/farmer_bills_screen.dart';
import '../farmer/farmer_khata_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import 'role_data.dart';
import 'role_prefs.dart';
import 'role_ui.dart';

const portalBase = 'https://alranatraders.pk/portal';

void push(BuildContext context, Widget page) => Navigator.push(context, MaterialPageRoute(builder: (_) => page));

Future<void> openPortal(BuildContext context, String path) async {
  final ok = await launchUrl(Uri.parse('$portalBase$path'), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) snack(context, 'Website nahi khul saki');
}

/// Kisan ka app: Home, Kheti, +, Dairy, Profile.
class FarmerShell extends StatefulWidget {
  const FarmerShell({super.key, required this.profile});
  final AppProfile profile;
  @override
  State<FarmerShell> createState() => _FarmerShellState();
}

class _FarmerShellState extends State<FarmerShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) {
    final pages = [FarmerHome(profile: widget.profile), const FarmsCropsScreen(embedded: true), const FarmerDairyHub(embedded: true), ProfileScreen(profile: widget.profile)];
    return RoleScaffold(
      index: index,
      onTap: (i) => setState(() => index = i),
      onPlus: () => showFarmerAddSheet(context),
      items: [
        NavEntry(Icons.home_rounded, context.tr(T.home)),
        NavEntry(Icons.grass_rounded, context.tr(T.farm)),
        NavEntry(Icons.pets_rounded, context.tr(T.dairy)),
        NavEntry(Icons.person_rounded, context.tr(T.profile)),
      ],
      body: pages[index],
    );
  }
}

void showFarmerAddSheet(BuildContext context) => showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: TileGrid(tiles: [
          TileData(Icons.inventory_2_rounded, const Color(0xFFE08A00), ctx.tr(T.demand), onTap: () { Navigator.pop(ctx); push(context, const ProductDemandScreen()); }),
          TileData(Icons.local_drink_rounded, const Color(0xFF1E88E5), ctx.tr(T.milkRecord), onTap: () { Navigator.pop(ctx); push(context, const FarmerDairyHub()); }),
          TileData(Icons.handshake_rounded, const Color(0xFF8E24AA), ctx.tr(T.promise), onTap: () { Navigator.pop(ctx); push(context, const FarmerWalletScreen()); }),
        ]),
      ),
    );

class FarmerHome extends ConsumerWidget {
  const FarmerHome({super.key, required this.profile});
  final AppProfile profile;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final row = ref.watch(farmerRowProvider).valueOrNull;
    final summary = ref.watch(farmerSummaryProvider).valueOrNull;
    final owed = (summary?['khata_owed'] as num?) ?? (AppConfig.demoMode ? 42500 : null);
    final animals = row == null ? null : ((row['cow_count'] as num? ?? 0) + (row['buffalo_count'] as num? ?? 0) + (row['calves_count'] as num? ?? 0));
    final crops = (row?['crop_types'] as List?)?.length;
    return ListView(padding: EdgeInsets.zero, children: [
      RoleTopBar(onBell: () => push(context, const NotificationsScreen())),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(children: [
        HeroBanner(title: context.tr(T.farmerDash), name: row?['full_name']?.toString() ?? profile.name, code: row?['farmer_code']?.toString() ?? ''),
        Transform.translate(offset: const Offset(0, -16), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: KpiStrip(items: [
          Kpi(Icons.landscape_rounded, const Color(0xFF43A047), num0(row?['land_size_acres'] as num?), context.tr(T.acres)),
          Kpi(Icons.grass_rounded, const Color(0xFF7CB342), num0(crops), context.tr(T.crops)),
          Kpi(Icons.pets_rounded, const Color(0xFF8D6E63), num0(animals), context.tr(T.animals)),
          Kpi(Icons.account_balance_wallet_rounded, const Color(0xFFD81B60), owed == null ? '—' : num0(-owed), context.tr(T.khata), valueColor: (owed ?? 0) > 0 ? RC.red : RC.ok),
        ]))),
        TileGrid(tiles: [
          TileData(Icons.event_note_rounded, const Color(0xFFF9A825), context.tr(T.seasonPlan), sub: 'Gandum / Munji', key: const ValueKey('tile-season'), onTap: () => push(context, const SeasonBookingScreen())),
          TileData(Icons.pets_rounded, const Color(0xFF6D4C41), context.tr(T.dairy), sub: 'Doodh · Janwar', key: const ValueKey('tile-dairy'), onTap: () => push(context, const FarmerDairyHub())),
          TileData(Icons.menu_book_rounded, const Color(0xFF00897B), context.tr(T.myKhata), sub: context.tr(T.statement), key: const ValueKey('tile-wallet'), onTap: () => push(context, const FarmerWalletScreen())),
          TileData(Icons.receipt_long_rounded, const Color(0xFF3949AB), context.tr(T.myBills), onTap: () => push(context, const FarmerBillsScreen())),
          TileData(Icons.inventory_2_rounded, const Color(0xFFE08A00), context.tr(T.demand), sub: 'Khaad · Spray', key: const ValueKey('tile-demand'), onTap: () => push(context, const ProductDemandScreen())),
          TileData(Icons.map_rounded, const Color(0xFF2E7D32), context.tr(T.farms), onTap: () => push(context, const FarmsCropsScreen())),
        ]),
        const SizedBox(height: 10),
        RCard(
          key: const ValueKey('kisan-ai'),
          color: context.isNavy ? RC.navyCard : const Color(0xFFE8F5E3),
          onTap: () => push(context, const KisanAiScreen()),
          child: Row(children: [
            const Icon(Icons.smart_toy_rounded, size: 34, color: RC.greenLight),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(context.tr(T.kisanAi), style: TextStyle(fontWeight: FontWeight.w800, color: context.accent)),
              Text(context.tr(T.kisanAiSub), style: TextStyle(fontSize: 10.5, color: context.muted)),
            ])),
            const CircleAvatar(radius: 13, backgroundColor: RC.green, child: Icon(Icons.chevron_right, color: Colors.white, size: 18)),
          ]),
        ),
        const SizedBox(height: 10),
        TextButton.icon(onPressed: () => push(context, const AllServicesScreen()), icon: const Icon(Icons.apps_rounded), label: Text(context.tr(T.allServices)), key: const ValueKey('all-services')),
        const SizedBox(height: 90),
      ])),
    ]);
  }
}

// ------------------------------------------------------------------ Dairy
class FarmerDairyHub extends ConsumerWidget {
  const FarmerDairyHub({super.key, this.embedded = false});
  final bool embedded;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final row = ref.watch(farmerRowProvider).valueOrNull;
    final milk = ref.watch(milkCollectionProvider).valueOrNull ?? const [];
    final today = AppConfig.demoMode ? demoDairy['today_l'] as num : (milk.isEmpty ? null : milk.first['total'] as num?);
    final total = AppConfig.demoMode ? demoDairy['total'] : row == null ? null : ((row['cow_count'] as num? ?? 0) + (row['buffalo_count'] as num? ?? 0) + (row['calves_count'] as num? ?? 0));
    final milking = AppConfig.demoMode ? demoDairy['milking'] : row?['milking_animal_count'];
    final body = ListView(padding: EdgeInsets.zero, children: [
      RoleTopBar(back: !embedded),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PageTitle(icon: Icons.pets_rounded, color: const Color(0xFF6D4C41), title: context.tr(T.dairyMgmt), sub: context.tr(T.dairySub)),
        Container(
          height: 118,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: context.isNavy ? const [Color(0xFF1B2D63), Color(0xFF2A4A3A)] : const [Color(0xFFBFE3F5), Color(0xFF9CCF6E)])),
          child: Stack(children: [
            const PositionedDirectional(start: 12, bottom: 4, child: Icon(Icons.pets_rounded, size: 84, color: Colors.white)),
            PositionedDirectional(end: 10, top: 10, child: SizedBox(width: 175, child: RCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(context.tr(T.todayMilk), style: TextStyle(fontSize: 10, color: context.muted)),
              Text(today == null ? '—' : '${num0(today)} L', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: context.accent)),
              FittedBox(child: Row(children: [
                Text('Fat ${AppConfig.demoMode ? demoDairy['fat'] : '—'}%', style: TextStyle(fontSize: 11, color: context.ink)),
                const SizedBox(width: 18),
                Text('LR ${AppConfig.demoMode ? demoDairy['lr'] : '—'}', style: TextStyle(fontSize: 11, color: context.ink)),
              ])),
            ])))),
          ]),
        ),
        const SizedBox(height: 8),
        KpiStrip(items: [
          Kpi(Icons.pets, const Color(0xFF8D6E63), num0(total as num?), context.tr(T.total)),
          Kpi(Icons.local_drink, const Color(0xFF1E88E5), num0(milking as num?), context.tr(T.milking)),
          Kpi(Icons.favorite, const Color(0xFFD6337A), num0(AppConfig.demoMode ? demoDairy['pregnant'] as num : null), context.tr(T.pregnant), valueColor: const Color(0xFFD6337A)),
          Kpi(Icons.water_drop_outlined, Colors.grey, num0(AppConfig.demoMode ? demoDairy['dry'] as num : null), context.tr(T.dry), valueColor: Colors.grey),
        ]),
        const SizedBox(height: 10),
        TileGrid(tiles: [
          TileData(Icons.local_drink_rounded, const Color(0xFF1E88E5), context.tr(T.milkRecord), onTap: () => openPortal(context, '/dairy')),
          TileData(Icons.pets_rounded, const Color(0xFF6D4C41), context.tr(T.animalRecords), onTap: () => openPortal(context, '/dairy')),
          TileData(Icons.eco_rounded, const Color(0xFF43A047), context.tr(T.feed), onTap: () => openPortal(context, '/dairy')),
          TileData(Icons.vaccines_rounded, const Color(0xFF00ACC1), context.tr(T.vaccine), onTap: () => openPortal(context, '/dairy')),
          TileData(Icons.favorite_rounded, const Color(0xFFD81B60), context.tr(T.breeding), onTap: () => openPortal(context, '/dairy')),
          TileData(Icons.bar_chart_rounded, const Color(0xFF5E35B1), context.tr(T.hisaab), sub: 'P&L', onTap: () => openPortal(context, '/dairy')),
          TileData(Icons.local_shipping_rounded, const Color(0xFFEF6C00), context.tr(T.milkSale), key: const ValueKey('tile-milk-sale'), onTap: () => _milkSaleSheet(context, row)),
          TileData(Icons.account_balance_rounded, const Color(0xFF3949AB), context.tr(T.animalLoan), key: const ValueKey('tile-animal-loan'), onTap: () => _loanSheet(context)),
          TileData(Icons.payments_rounded, const Color(0xFF2E7D32), context.tr(T.milkIncome), onTap: () => push(context, const FarmerKhataScreen())),
        ]),
        const SizedBox(height: 90),
      ])),
    ]);
    return embedded ? body : Scaffold(body: body);
  }

  void _milkSaleSheet(BuildContext context, Map<String, dynamic>? row) => showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (ctx) => Padding(padding: const EdgeInsets.fromLTRB(18, 0, 18, 28), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(ctx.tr(T.milkSale), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          _kv(ctx, 'Khareedar', row?['milk_buyer_name']?.toString() ?? '—'),
          _kv(ctx, 'Rate / litre', rs(row?['milk_sale_rate'] as num?)),
          _kv(ctx, 'Litre / din', num0(row?['milk_liters_per_day'] as num?)),
          _kv(ctx, 'Doodh par advance', rs(row?['milk_advance_loan_amount'] as num?)),
          const SizedBox(height: 8),
          Text('Tabdeeli ke liye staff se rabta karein.', style: TextStyle(fontSize: 11, color: ctx.muted)),
        ])),
      );

  void _loanSheet(BuildContext context) => showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (ctx) => Padding(padding: const EdgeInsets.fromLTRB(18, 0, 18, 28), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(ctx.tr(T.animalLoan), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('Maweshi loan ki darkhwast website ke Dairy hissay se jati hai. Faisla staff check ke baad hota hai.'),
          const SizedBox(height: 12),
          FilledButton.icon(onPressed: () { Navigator.pop(ctx); openPortal(context, '/dairy'); }, icon: const Icon(Icons.open_in_new), label: const Text('Request kholein')),
        ])),
      );

  static Widget _kv(BuildContext c, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [Expanded(child: Text(k, style: TextStyle(color: c.muted))), Text(v, style: const TextStyle(fontWeight: FontWeight.w800))]),
      );
}

// ------------------------------------------------------------------ Farms / crops
class FarmsCropsScreen extends ConsumerStatefulWidget {
  const FarmsCropsScreen({super.key, this.embedded = false});
  final bool embedded;
  @override
  ConsumerState<FarmsCropsScreen> createState() => _FarmsCropsState();
}

class _FarmsCropsState extends ConsumerState<FarmsCropsScreen> {
  int tab = 0;
  @override
  Widget build(BuildContext context) {
    final row = ref.watch(farmerRowProvider).valueOrNull;
    final crops = List<String>.from((row?['crop_types'] as List?) ?? const []);
    const steps = ['Sowing', 'Irrigation', 'Fertilizer', 'Spray'];
    final body = ListView(padding: EdgeInsets.zero, children: [
      RoleTopBar(back: !widget.embedded),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PageTitle(icon: Icons.grass_rounded, color: const Color(0xFF43A047), title: context.tr(T.farms), sub: 'Behtar fasal, unchi paidawar'),
        SegmentedButton<int>(segments: [ButtonSegment(value: 0, label: Text(context.tr(T.farms))), ButtonSegment(value: 1, label: Text(context.tr(T.crops)))], selected: {tab}, onSelectionChanged: (s) => setState(() => tab = s.first)),
        const SizedBox(height: 10),
        if (tab == 0)
          RCard(child: Row(children: [
            const Icon(Icons.landscape_rounded, size: 40, color: Color(0xFF43A047)),
            const SizedBox(width: 10),
            Expanded(child: Text('${num0(row?['land_size_acres'] as num?)} ${context.tr(T.acres)}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: context.ink))),
            TextButton(onPressed: () => openPortal(context, '/farms'), child: const Text('Kheet')),
          ]))
        else ...[
          for (final c in crops.isEmpty ? <String>['—'] : crops)
            Padding(padding: const EdgeInsets.only(bottom: 9), child: RCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: context.ink)),
              const SizedBox(height: 8),
              Row(children: [for (var i = 0; i < steps.length; i++) Expanded(child: Column(children: [
                Icon(i < 2 ? Icons.check_circle : i == 2 ? Icons.timelapse : Icons.radio_button_unchecked, color: i < 2 ? RC.ok : i == 2 ? const Color(0xFF1E88E5) : Colors.grey),
                Text(steps[i], style: TextStyle(fontSize: 10, color: context.muted)),
              ]))]),
            ]))),
          TextButton(onPressed: () => openPortal(context, '/crops'), child: const Text('Fasal ki tafseel website par')),
        ],
        const SizedBox(height: 90),
      ])),
    ]);
    return widget.embedded ? body : Scaffold(body: body);
  }
}

// ------------------------------------------------------------------ Wallet / Khata
class FarmerWalletScreen extends ConsumerWidget {
  const FarmerWalletScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(khataSummaryProvider).valueOrNull;
    final row = ref.watch(farmerRowProvider).valueOrNull;
    final owed = AppConfig.demoMode ? 42500 : (summary?['owed'] as num?);
    final statement = ref.watch(khataStatementProvider).valueOrNull ?? const [];
    final tx = AppConfig.demoMode
        ? demoFarmerTx
        : statement.reversed.take(8).map((r) {
            final u = (r['udhaar'] as num?) ?? 0, a = (r['adaigi'] as num?) ?? 0;
            return {'title': r['tafseel'] ?? r['ref'] ?? '', 'sub': r['category'] ?? '', 'amount': a > 0 ? a : -u, 'date': r['entry_date'] ?? ''};
          }).toList();
    return Scaffold(body: ListView(padding: EdgeInsets.zero, children: [
      const RoleTopBar(back: true),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PageTitle(icon: Icons.account_balance_wallet_rounded, color: const Color(0xFF00897B), title: context.tr(T.wallet), sub: context.tr(T.walletSub)),
        Row(children: [
          Expanded(flex: 13, child: RCard(gradient: const LinearGradient(colors: [RC.green, RC.greenLight]), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Doodh ka advance', style: TextStyle(color: Colors.white70, fontSize: 11)),
            Text(rs(row?['milk_advance_loan_amount'] as num?), style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
          ]))),
          const SizedBox(width: 9),
          Expanded(flex: 10, child: RCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(context.tr(T.due), style: TextStyle(fontSize: 11, color: context.muted)),
            FittedBox(child: Text(rs(owed), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: RC.red))),
          ]))),
        ]),
        const SizedBox(height: 9),
        TileGrid(columns: 3, compact: true, tiles: [
          TileData(Icons.menu_book_rounded, const Color(0xFF00897B), context.tr(T.statement), onTap: () => push(context, const FarmerKhataScreen())),
          TileData(Icons.handshake_rounded, const Color(0xFF8E24AA), context.tr(T.promise), onTap: () => openPortal(context, '/wallet')),
          TileData(Icons.verified_rounded, RC.green, context.tr(T.reportPayment), sub: 'Claim', onTap: () => openPortal(context, '/wallet')),
        ]),
        SectionHead(context.tr(T.latestTx), action: context.tr(T.viewAll), onAction: () => push(context, const FarmerKhataScreen())),
        RCard(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), child: Column(children: [
          for (final t in tx)
            TxRow(icon: _txIcon(t['icon']?.toString()), title: '${t['title']}', sub: '${t['sub']}', amount: '${(t['amount'] as num) >= 0 ? '+' : '-'} ${rs((t['amount'] as num).abs())}', positive: (t['amount'] as num) >= 0, trail: '${t['date']}'),
          if (tx.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Abhi koi len den nahi')),
        ])),
        const SizedBox(height: 8),
        Center(child: Text(context.tr(T.noUdhaar), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: context.muted))),
        const SizedBox(height: 24),
      ])),
    ]));
  }

  static IconData _txIcon(String? k) => switch (k) {
        'milk' => Icons.local_drink_rounded,
        'cash' => Icons.payments_rounded,
        'spray' => Icons.sanitizer_rounded,
        'season' => Icons.event_note_rounded,
        _ => Icons.science_rounded,
      };
}

// ------------------------------------------------------------------ Season booking (Gandum / Munji)
class SeasonBookingScreen extends StatelessWidget {
  const SeasonBookingScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(body: ListView(padding: EdgeInsets.zero, children: [
        const RoleTopBar(back: true),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          PageTitle(icon: Icons.event_note_rounded, color: const Color(0xFFF9A825), title: context.tr(T.seasonPlan), sub: 'Credit sirf season plan se'),
          for (final p in const [('Gandum', 'Rabi · Nov–Apr', Icons.grass_rounded, Color(0xFFF9A825)), ('Munji', 'Kharif · Jun–Oct', Icons.rice_bowl_rounded, Color(0xFF43A047))])
            Padding(padding: const EdgeInsets.only(bottom: 10), child: RCard(onTap: () => openPortal(context, '/campaigns'), child: Row(children: [
              Icon(p.$3, size: 40, color: p.$4), const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${p.$1} Plan', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: context.ink)),
                Text(p.$2, style: TextStyle(fontSize: 11, color: context.muted)),
              ])),
              const Icon(Icons.chevron_right),
            ]))),
          Text('Booking website ke Season Booking se hoti hai; staff verify karta hai.', style: TextStyle(fontSize: 11, color: context.muted)),
        ])),
      ]));
}

// ------------------------------------------------------------------ Product demand (category-first)
class ProductDemandScreen extends ConsumerStatefulWidget {
  const ProductDemandScreen({super.key});
  @override
  ConsumerState<ProductDemandScreen> createState() => _DemandState();
}

class _DemandState extends ConsumerState<ProductDemandScreen> {
  DemandCategory? cat;
  final product = TextEditingController();
  final qty = TextEditingController(text: '1');
  bool busy = false;
  static const colors = [Color(0xFFE08A00), Color(0xFF43A047), Color(0xFF1E88E5), Color(0xFF8D6E63), Color(0xFF6D4C41), Color(0xFF757575)];
  static const icons = [Icons.shopping_basket_rounded, Icons.science_rounded, Icons.sanitizer_rounded, Icons.spa_rounded, Icons.agriculture_rounded, Icons.more_horiz_rounded];

  @override
  void dispose() { product.dispose(); qty.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final lang = LangScope.of(context);
    final products = ref.watch(productsProvider).valueOrNull ?? const [];
    final match = cat == null ? const [] : products.where((p) => _belongs(p.category, cat!.code)).toList();
    return Scaffold(body: ListView(padding: EdgeInsets.zero, children: [
      const RoleTopBar(back: true),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PageTitle(icon: Icons.inventory_2_rounded, color: const Color(0xFFE08A00), title: context.tr(T.demand), sub: context.tr(T.chooseCategory)),
        TileGrid(compact: true, tiles: [
          for (var i = 0; i < DemandCategory.all.length; i++)
            TileData(icons[i], colors[i], switch (lang) { AppLang.en => DemandCategory.all[i].en, AppLang.roman => DemandCategory.all[i].roman, AppLang.ur => DemandCategory.all[i].ur },
                key: ValueKey('cat-${DemandCategory.all[i].code}'), badge: cat == DemandCategory.all[i] ? 1 : null,
                onTap: () => setState(() { cat = DemandCategory.all[i]; product.clear(); })),
        ]),
        if (cat != null) ...[
          SectionHead('${cat!.roman} · unit: ${cat!.unit}'),
          if (match.isNotEmpty)
            Wrap(spacing: 6, runSpacing: 6, children: [for (final p in match.take(12)) ActionChip(label: Text(p.name), onPressed: () => setState(() => product.text = p.name))]),
          const SizedBox(height: 8),
          TextField(key: const ValueKey('demand-product'), controller: product, decoration: const InputDecoration(labelText: 'Product ka naam', border: OutlineInputBorder())),
          const SizedBox(height: 8),
          TextField(key: const ValueKey('demand-qty'), controller: qty, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'Miqdar (${cat!.unit})', border: const OutlineInputBorder())),
          const SizedBox(height: 10),
          SizedBox(width: double.infinity, child: FilledButton(key: const ValueKey('demand-submit'), onPressed: busy ? null : _submit, child: const Text('Demand bhejein'))),
        ],
        const SizedBox(height: 24),
      ])),
    ]));
  }

  static bool _belongs(String productCategory, String code) {
    final c = productCategory.toLowerCase();
    return switch (code) {
      'fertilizer' => c.contains('fert') || c.contains('khaad') || c.contains('micro'),
      'pesticide' => c.contains('pest') || c.contains('spray') || c.contains('herb') || c.contains('insect') || c.contains('fung'),
      'seed' => c.contains('seed') || c.contains('beej'),
      'wanda' => c.contains('feed') || c.contains('wanda'),
      'karyana' => c.contains('karyana') || c.contains('grocery'),
      _ => false,
    };
  }

  Future<void> _submit() async {
    final q = double.tryParse(qty.text.trim());
    if (product.text.trim().length < 2 || q == null || q <= 0) { snack(context, 'Product aur miqdar likhein'); return; }
    if (AppConfig.demoMode) { snack(context, 'Demo: demand save (namoona)'); Navigator.pop(context); return; }
    final farmerId = (await ref.read(roleRepositoryProvider).whoami())?['farmer_id']?.toString();
    if (farmerId == null) { if (mounted) snack(context, 'Kisan account nahi mila'); return; }
    setState(() => busy = true);
    try {
      await ref.read(roleRepositoryProvider).submitDemand(farmerId: farmerId, category: cat!.code, product: product.text.trim(), qty: q, unit: cat!.unit);
      if (mounted) { snack(context, 'Demand bhej di gayi'); Navigator.pop(context); }
    } catch (e) {
      if (mounted) snack(context, 'Demand nahi gayi: $e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}

// ------------------------------------------------------------------ All services
class AllServicesScreen extends ConsumerWidget {
  const AllServicesScreen({super.key, this.customer = false});
  final bool customer;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget group(String title, List<TileData> tiles) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionHead(title), TileGrid(columns: 4, compact: true, tiles: tiles)]);
    return Scaffold(body: ListView(padding: EdgeInsets.zero, children: [
      const RoleTopBar(back: true),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PageTitle(icon: Icons.apps_rounded, color: const Color(0xFF5E35B1), title: context.tr(T.allServices)),
        group('Hisaab', [
          TileData(Icons.menu_book_rounded, const Color(0xFF00897B), context.tr(T.myKhata), onTap: () => push(context, const FarmerKhataScreen())),
          TileData(Icons.receipt_long_rounded, const Color(0xFF3949AB), context.tr(T.myBills), onTap: () => push(context, const FarmerBillsScreen())),
          TileData(Icons.payments_rounded, const Color(0xFF2E7D32), context.tr(T.payments), onTap: () => openPortal(context, '/wallet')),
          TileData(Icons.handshake_rounded, const Color(0xFF8E24AA), context.tr(T.promises), onTap: () => openPortal(context, '/wallet')),
        ]),
        if (!customer) group(context.tr(T.dairy), [
          TileData(Icons.local_drink_rounded, const Color(0xFF1E88E5), context.tr(T.milkRecord), onTap: () => push(context, const FarmerDairyHub())),
          TileData(Icons.pets_rounded, const Color(0xFF6D4C41), context.tr(T.animalRecords), onTap: () => push(context, const FarmerDairyHub())),
          TileData(Icons.local_shipping_rounded, const Color(0xFFEF6C00), context.tr(T.milkSale), onTap: () => push(context, const FarmerDairyHub())),
          TileData(Icons.account_balance_rounded, const Color(0xFF3949AB), context.tr(T.animalLoan), onTap: () => push(context, const FarmerDairyHub())),
        ]),
        if (!customer) group(context.tr(T.farming), [
          TileData(Icons.map_rounded, const Color(0xFF2E7D32), context.tr(T.farms), onTap: () => push(context, const FarmsCropsScreen())),
          TileData(Icons.grass_rounded, const Color(0xFF7CB342), context.tr(T.crops), onTap: () => push(context, const FarmsCropsScreen())),
          TileData(Icons.event_note_rounded, const Color(0xFFF9A825), context.tr(T.seasonPlan), onTap: () => push(context, const SeasonBookingScreen())),
          TileData(Icons.smart_toy_rounded, RC.greenLight, context.tr(T.kisanAi), onTap: () => push(context, const KisanAiScreen())),
        ]),
        group(context.tr(T.services), [
          TileData(Icons.inventory_2_rounded, const Color(0xFFE08A00), context.tr(T.demand), onTap: () => push(context, const ProductDemandScreen())),
          TileData(Icons.shopping_bag_rounded, const Color(0xFF00838F), context.tr(T.orders), onTap: () => push(context, const OrderHistoryScreen())),
          TileData(Icons.undo_rounded, const Color(0xFF6D4C41), context.tr(T.returns), onTap: () => openPortal(context, '/orders')),
          TileData(Icons.support_agent_rounded, const Color(0xFFD81B60), context.tr(T.support), onTap: () => openPortal(context, '/services')),
        ]),
        group(context.tr(T.account), [
          TileData(Icons.translate_rounded, const Color(0xFF1E88E5), context.tr(T.language), key: const ValueKey('svc-lang'), onTap: () {
            final n = ref.read(appLangProvider.notifier);
            n.state = AppLang.values[(n.state.index + 1) % AppLang.values.length];
          }),
          TileData(Icons.dark_mode_rounded, const Color(0xFF283593), context.tr(T.theme), key: const ValueKey('svc-theme'), onTap: () => ref.read(navyDarkProvider.notifier).state = !ref.read(navyDarkProvider)),
          TileData(Icons.lock_rounded, const Color(0xFF546E7A), 'Password', onTap: () => openPortal(context, '/profile')),
          TileData(Icons.delete_outline_rounded, RC.red, context.tr(T.deleteAcc), onTap: () => launchUrl(Uri.parse('https://alranatraders.pk/account-deletion'), mode: LaunchMode.externalApplication)),
        ]),
        const SizedBox(height: 24),
      ])),
    ]));
  }
}
