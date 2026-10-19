import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/data/mobile_providers.dart';
import '../../core/models/app_role.dart';
import '../commerce/order_history_screen.dart';
import '../farmer/farmer_bills_screen.dart';
import '../farmer/farmer_khata_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import 'farmer_screens.dart';
import 'role_data.dart';
import 'role_prefs.dart';
import 'role_ui.dart';

/// Customer: Home, Khata, +, Orders, Profile (owner ka faisla).
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, required this.profile});
  final AppProfile profile;
  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[CustomerHome(profile: widget.profile), const FarmerKhataScreen(), const OrderHistoryScreen(), ProfileScreen(profile: widget.profile)];
    return RoleScaffold(
      index: index,
      onTap: (i) => setState(() => index = i),
      onPlus: () => showModalBottomSheet(context: context, showDragHandle: true, builder: (ctx) => Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            child: TileGrid(tiles: [
              TileData(Icons.inventory_2_rounded, const Color(0xFFE08A00), ctx.tr(T.demand), onTap: () { Navigator.pop(ctx); push(context, const ProductDemandScreen()); }),
              TileData(Icons.verified_rounded, RC.green, ctx.tr(T.reportPayment), onTap: () { Navigator.pop(ctx); openPortal(context, '/wallet'); }),
              TileData(Icons.handshake_rounded, const Color(0xFF8E24AA), ctx.tr(T.promise), onTap: () { Navigator.pop(ctx); openPortal(context, '/wallet'); }),
            ]),
          )),
      items: [
        NavEntry(Icons.home_rounded, context.tr(T.home)),
        NavEntry(Icons.menu_book_rounded, context.tr(T.khata)),
        NavEntry(Icons.shopping_bag_rounded, context.tr(T.orders)),
        NavEntry(Icons.person_rounded, context.tr(T.profile)),
      ],
      body: pages[index],
    );
  }
}

class CustomerHome extends ConsumerWidget {
  const CustomerHome({super.key, required this.profile});
  final AppProfile profile;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(khataSummaryProvider).valueOrNull;
    final statement = ref.watch(khataStatementProvider).valueOrNull ?? const [];
    final demo = AppConfig.demoMode;
    final due = demo ? demoCustomer['due'] as num : summary?['owed'] as num?;
    final last = demo ? demoCustomer['last_payment'] as num : (summary?['last_payment'] as Map?)?['amount'] as num?;
    final rows = demo
        ? demoCustomerKhata
        : statement.reversed.take(5).map((r) {
            final u = (r['udhaar'] as num?) ?? 0, a = (r['adaigi'] as num?) ?? 0;
            return {'title': r['tafseel'] ?? r['ref'] ?? '', 'sub': r['ref'] ?? '', 'amount': a > 0 ? a : -u, 'date': r['entry_date'] ?? ''};
          }).toList();
    return ListView(padding: EdgeInsets.zero, children: [
      RoleTopBar(onBell: () => push(context, const NotificationsScreen())),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        HeroBanner(title: context.tr(T.customerPortal), name: demo ? demoCustomer['name'] as String : profile.name, code: demo ? '${demoCustomer['code']} · ${demoCustomer['branch']}' : '', icon: Icons.storefront_rounded, warm: true),
        const SizedBox(height: 10),
        RCard(
          key: const ValueKey('customer-khata-card'),
          gradient: const LinearGradient(colors: [RC.green, RC.greenLight]),
          onTap: () => push(context, const FarmerKhataScreen()),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${context.tr(T.myKhata)} · ${context.tr(T.due)}', style: const TextStyle(color: Colors.white70, fontSize: 11)),
              Text(rs(due), style: const TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w900)),
              Text('Aakhri payment: ${rs(last)}', style: const TextStyle(color: Colors.white70, fontSize: 10.5)),
            ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(color: RC.gold, borderRadius: BorderRadius.circular(10)),
              child: Text(context.tr(T.reportPayment), style: const TextStyle(color: RC.green, fontWeight: FontWeight.w900, fontSize: 12)),
            ),
          ]),
        ),
        const SizedBox(height: 10),
        TileGrid(tiles: [
          TileData(Icons.menu_book_rounded, const Color(0xFF00897B), context.tr(T.statement), sub: context.tr(T.khata), onTap: () => push(context, const FarmerKhataScreen())),
          TileData(Icons.receipt_long_rounded, const Color(0xFF3949AB), context.tr(T.myBills), sub: demo ? '12 bills' : null, onTap: () => push(context, const FarmerBillsScreen())),
          TileData(Icons.shopping_bag_rounded, const Color(0xFF00838F), context.tr(T.orders), sub: demo ? '2 pending' : null, onTap: () => push(context, const OrderHistoryScreen())),
          TileData(Icons.payments_rounded, const Color(0xFF2E7D32), context.tr(T.payments), onTap: () => openPortal(context, '/wallet')),
          TileData(Icons.handshake_rounded, const Color(0xFF8E24AA), context.tr(T.promises), sub: demo ? '1 active' : null, onTap: () => openPortal(context, '/wallet')),
          TileData(Icons.inventory_2_rounded, const Color(0xFFE08A00), context.tr(T.demand), sub: 'Karyana', onTap: () => push(context, const ProductDemandScreen())),
        ]),
        SectionHead('${context.tr(T.khata)} — ${context.tr(T.latestTx)}', action: context.tr(T.viewAll), onAction: () => push(context, const FarmerKhataScreen())),
        RCard(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), child: Column(children: [
          for (final t in rows)
            TxRow(icon: (t['amount'] as num) >= 0 ? Icons.payments_rounded : Icons.receipt_long_rounded, title: '${t['title']}', sub: '${t['sub']}', amount: '${(t['amount'] as num) >= 0 ? '+' : '-'} ${rs((t['amount'] as num).abs())}', positive: (t['amount'] as num) >= 0, trail: '${t['date']}'),
          if (rows.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Abhi koi len den nahi')),
        ])),
        TextButton.icon(onPressed: () => push(context, const AllServicesScreen(customer: true)), icon: const Icon(Icons.apps_rounded), label: Text(context.tr(T.allServices))),
        const SizedBox(height: 90),
      ])),
    ]);
  }
}
