import 'package:flutter/material.dart';

import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class DealerDashboard extends StatelessWidget {
  const DealerDashboard({super.key, required this.profile});
  final AppProfile profile;
  @override
  Widget build(BuildContext context) => CustomScrollView(slivers: [
    SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Aap ka bharosa, hamari pehchan')),
    SliverPadding(padding: const EdgeInsets.all(16), sliver: SliverList.list(children: [
      Card(child: Padding(padding: const EdgeInsets.all(18), child: Column(children: [
        const Row(children: [CircleAvatar(backgroundColor: AppColors.green, child: Icon(Icons.account_balance_wallet_outlined, color: Colors.white)), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Dealer Statement', style: TextStyle(fontSize: 12)), Text('Rs 156,000', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800)), Text('Current Balance (Receivable)', style: TextStyle(fontSize: 10, color: AppColors.muted))])), Icon(Icons.chevron_right)]),
        const Divider(height: 28), Row(children: [Expanded(child: _Limit('Credit Limit', 'Rs 500,000')), Expanded(child: _Limit('Available Limit', 'Rs 344,000'))]),
      ]))),
      const SizedBox(height: 14),
      const GridView.count(shrinkWrap: true, physics: NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.1, children: [
        QuickAction(label: 'New Order', icon: Icons.add_shopping_cart), QuickAction(label: 'Order History', icon: Icons.receipt_long_outlined), QuickAction(label: 'Payments', icon: Icons.credit_card_outlined), QuickAction(label: 'Credit Limit', icon: Icons.bar_chart_rounded),
      ]),
      const SizedBox(height: 16), const SectionTitle('Recent Orders'), const SizedBox(height: 8),
      const Card(child: Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Column(children: [
        StatusRow(title: '#ORD-7842 • Rs 48,500', subtitle: '15 Apr 2026', status: 'Delivered'), Divider(height: 1),
        StatusRow(title: '#ORD-7841 • Rs 72,000', subtitle: '12 Apr 2026', status: 'Pending', color: Colors.orange), Divider(height: 1),
        StatusRow(title: '#ORD-7839 • Rs 36,200', subtitle: '10 Apr 2026', status: 'Delivered'), Divider(height: 1),
        StatusRow(title: '#ORD-7838 • Rs 54,800', subtitle: '08 Apr 2026', status: 'Pending', color: Colors.orange),
      ]))),
    ]))
  ]);
}

class _Limit extends StatelessWidget {
  const _Limit(this.label, this.value); final String label; final String value;
  @override Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 10, color: AppColors.muted)), Text(value, style: const TextStyle(fontWeight: FontWeight.w800))]);
}
