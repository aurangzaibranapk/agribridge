import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_config.dart';
import '../../../core/data/mobile_providers.dart';
import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class StaffDashboard extends ConsumerWidget {
  const StaffDashboard({super.key, required this.profile});
  final AppProfile profile;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(roleDashboardSummaryProvider);
    final summary = state.valueOrNull ?? const <String, dynamic>{};
    String count(String key) => state.isLoading && !AppConfig.demoMode ? '—' : '${summary[key] ?? 0}';
    String money(String key) => state.isLoading && !AppConfig.demoMode ? '—' : 'Rs ${NumberFormat('#,##0').format((summary[key] as num?) ?? 0)}';
    return CustomScrollView(slivers: [
    SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Teamwork grows progress', badge: 'Sales Staff')),
    SliverPadding(padding: const EdgeInsets.all(16), sliver: SliverList.list(children: [
      SizedBox(height: 220, child: GridView.count(physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.55, children: [
        MetricCard(label: 'Allowed Features', value: count('allowed_features'), icon: Icons.assignment_outlined, caption: 'Your permissions'),
        MetricCard(label: 'Today Orders', value: count('today_orders'), icon: Icons.shopping_cart_outlined, caption: money('today_order_value')),
        MetricCard(label: 'Pending Orders', value: count('pending_orders'), icon: Icons.local_shipping_outlined, tint: Colors.orange, caption: 'Your orders'),
        MetricCard(label: 'Unread Alerts', value: count('unread_notifications'), icon: Icons.notifications_outlined, tint: Colors.blue, caption: 'Needs attention'),
      ])),
      if (state.hasError && !AppConfig.demoMode) TextButton.icon(onPressed: () => ref.invalidate(roleDashboardSummaryProvider), icon: const Icon(Icons.refresh), label: const Text('Dashboard dobara load karein')),
      if (AppConfig.demoMode) ...[
        const SizedBox(height: 16), const SectionTitle("Preview Tasks"), const SizedBox(height: 8),
        const Card(child: Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Column(children: [
        StatusRow(title: 'Visit Al-Farooq Dairy', subtitle: 'Gulberg, Faisalabad • 09:00 AM', status: 'Completed'), Divider(height: 1),
        StatusRow(title: 'Take Order — Chaudhry Feed Store', subtitle: 'D-Ground • 11:30 AM', status: 'In Progress', color: Colors.blue), Divider(height: 1),
        StatusRow(title: 'Deliver — Rana Traders', subtitle: 'Samanabad • 02:00 PM', status: 'Pending', color: Colors.orange), Divider(height: 1),
        StatusRow(title: 'Collect Payment — Usman Agro', subtitle: 'Jaranwala Road • 04:00 PM', status: 'Pending', color: Colors.orange),
        ]))),
      ],
      const SizedBox(height: 14),
      Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFFFFF8E7), border: Border.all(color: AppColors.gold), borderRadius: BorderRadius.circular(16)), child: const Row(children: [Icon(Icons.campaign_outlined, color: AppColors.gold), SizedBox(width: 10), Expanded(child: Text('Sirf assigned branch aur shop\nApni assigned branch aur allowed shops tak hi kaam karein.', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)))])),
    ]))
  ]);
  }
}
