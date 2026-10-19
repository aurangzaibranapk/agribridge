import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_config.dart';
import '../../../core/data/mobile_providers.dart';
import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../commerce/order_history_screen.dart';
import '../../commerce/product_catalog_screen.dart';

class DealerDashboard extends ConsumerWidget {
  const DealerDashboard({super.key, required this.profile, this.onNotifications});
  final AppProfile profile;
  final VoidCallback? onNotifications;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(roleDashboardSummaryProvider);
    final summary = state.valueOrNull ?? const <String, dynamic>{};
    String count(String key) => state.isLoading && !AppConfig.demoMode ? '—' : '${summary[key] ?? 0}';
    String money(String key) => state.isLoading && !AppConfig.demoMode ? '—' : 'Rs ${NumberFormat('#,##0').format((summary[key] as num?) ?? 0)}';
    return CustomScrollView(slivers: [
    SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Aap ka bharosa, hamari pehchan', onNotifications: onNotifications, notificationCount: (summary['unread_notifications'] as num?)?.toInt() ?? 0)),
    SliverPadding(padding: const EdgeInsets.all(16), sliver: SliverList.list(children: [
      Card(child: Padding(padding: const EdgeInsets.all(18), child: Column(children: [
        Row(children: [const CircleAvatar(backgroundColor: AppColors.green, child: Icon(Icons.account_balance_wallet_outlined, color: Colors.white)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Dealer Statement', style: TextStyle(fontSize: 12)), Text(money('dealer_payable'), style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w800)), const Text('Current Payable', style: TextStyle(fontSize: 10, color: AppColors.muted))])), const Icon(Icons.chevron_right)]),
        const Divider(height: 28), Row(children: [Expanded(child: _Limit('Today Orders', count('today_orders'))), Expanded(child: _Limit('Pending Orders', count('pending_orders')))]),
      ]))),
      if (state.hasError && !AppConfig.demoMode) TextButton.icon(onPressed: () => ref.invalidate(roleDashboardSummaryProvider), icon: const Icon(Icons.refresh), label: const Text('Dashboard dobara load karein')),
      const SizedBox(height: 14),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.1, children: [
        QuickAction(label: 'New Order', icon: Icons.add_shopping_cart, onTap: () => _open(context, const ProductCatalogScreen())),
        QuickAction(label: 'Order History', icon: Icons.receipt_long_outlined, onTap: () => _open(context, const OrderHistoryScreen())),
        QuickAction(label: 'Notifications', icon: Icons.notifications_outlined, onTap: onNotifications),
        QuickAction(label: 'Dealer Balance', icon: Icons.bar_chart_rounded, onTap: () => _showInfo(context, 'Dealer Balance', 'Current payable dashboard ke upar Testing database se dikh raha hai.')),
      ]),
      if (AppConfig.demoMode) ...[
        const SizedBox(height: 16), const SectionTitle('Preview Orders'), const SizedBox(height: 8),
        const Card(child: Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Column(children: [
        StatusRow(title: '#ORD-7842 • Rs 48,500', subtitle: '15 Apr 2026', status: 'Delivered'), Divider(height: 1),
        StatusRow(title: '#ORD-7841 • Rs 72,000', subtitle: '12 Apr 2026', status: 'Pending', color: Colors.orange), Divider(height: 1),
        StatusRow(title: '#ORD-7839 • Rs 36,200', subtitle: '10 Apr 2026', status: 'Delivered'), Divider(height: 1),
        StatusRow(title: '#ORD-7838 • Rs 54,800', subtitle: '08 Apr 2026', status: 'Pending', color: Colors.orange),
        ]))),
      ],
    ]))
  ]);
  }

  void _open(BuildContext context, Widget screen) => Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  void _showInfo(BuildContext context, String title, String message) => showModalBottomSheet(context: context, showDragHandle: true, builder: (_) => Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 28), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), const SizedBox(height: 8), Text(message)])));
}

class _Limit extends StatelessWidget {
  const _Limit(this.label, this.value); final String label; final String value;
  @override Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 10, color: AppColors.muted)), Text(value, style: const TextStyle(fontWeight: FontWeight.w800))]);
}
