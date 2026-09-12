import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_config.dart';
import '../../../core/data/mobile_providers.dart';
import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class AdminDashboard extends ConsumerWidget {
  const AdminDashboard({super.key, required this.profile});
  final AppProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(roleDashboardSummaryProvider);
    final summary = state.valueOrNull ?? const <String, dynamic>{};
    String count(String key) => state.isLoading && !AppConfig.demoMode ? '—' : '${summary[key] ?? 0}';
    String money(String key) => state.isLoading && !AppConfig.demoMode ? '—' : 'Rs ${NumberFormat('#,##0').format((summary[key] as num?) ?? 0)}';
    return CustomScrollView(slivers: [
        SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Complete oversight for a stronger tomorrow')),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList.list(children: [
            Card(child: ListTile(leading: const Icon(Icons.business, color: AppColors.green), title: const Text('Business View', style: TextStyle(fontSize: 11)), subtitle: const Text('Master View', style: TextStyle(fontWeight: FontWeight.w800)), trailing: const Icon(Icons.keyboard_arrow_down))),
            const SizedBox(height: 14),
            SizedBox(height: 220, child: GridView.count(physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.55, children: [
              MetricCard(label: 'Today Orders', value: count('today_orders'), icon: Icons.point_of_sale, caption: 'Testing database'),
              MetricCard(label: 'Order Value', value: money('today_order_value'), icon: Icons.account_balance_wallet_outlined, caption: 'Today'),
              MetricCard(label: 'Unread Alerts', value: count('unread_notifications'), icon: Icons.notifications_outlined, tint: Colors.orange, caption: 'Your alerts'),
              MetricCard(label: 'Pending Orders', value: count('pending_orders'), icon: Icons.fact_check_outlined, tint: Colors.blue, caption: 'Needs attention'),
            ])),
            if (state.hasError && !AppConfig.demoMode) TextButton.icon(onPressed: () => ref.invalidate(roleDashboardSummaryProvider), icon: const Icon(Icons.refresh), label: const Text('Dashboard dobara load karein')),
            if (AppConfig.demoMode) ...[
              const SizedBox(height: 16),
              const SectionTitle('Preview Overview', action: 'Demo'),
              const SizedBox(height: 8),
              const Card(child: SizedBox(height: 150, child: Padding(padding: EdgeInsets.all(16), child: _Bars()))),
              const SizedBox(height: 16),
              const SectionTitle('Preview Attention'),
              const SizedBox(height: 8),
              const Card(child: Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Column(children: [
              StatusRow(title: 'Low Stock', subtitle: '8 items below minimum level', status: 'Review', color: Colors.orange, icon: Icons.warning_amber),
              Divider(height: 1),
              StatusRow(title: 'Payment Due', subtitle: '12 dealer payments overdue', status: 'Due', color: Colors.red, icon: Icons.payments_outlined),
              Divider(height: 1),
              StatusRow(title: 'Staff Requests', subtitle: '3 access requests pending', status: 'Approve', color: Colors.blue, icon: Icons.people_outline),
              ]))),
            ],
          ]),
        ),
      ]);
  }
}

class _Bars extends StatelessWidget {
  const _Bars();
  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.spaceAround,
    children: [42, 68, 53, 79, 62, 72, 86].map((h) => Column(mainAxisAlignment: MainAxisAlignment.end, children: [
      Container(width: 18, height: h.toDouble(), decoration: BoxDecoration(color: AppColors.green, borderRadius: const BorderRadius.vertical(top: Radius.circular(5)))),
      const SizedBox(height: 6), Text(['M','T','W','T','F','S','S'][[42,68,53,79,62,72,86].indexOf(h)], style: const TextStyle(fontSize: 9)),
    ])).toList());
}
