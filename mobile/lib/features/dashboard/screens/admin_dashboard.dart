import 'package:flutter/material.dart';

import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class AdminDashboard extends StatelessWidget {
  const AdminDashboard({super.key, required this.profile});
  final AppProfile profile;

  @override
  Widget build(BuildContext context) => CustomScrollView(slivers: [
        SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Complete oversight for a stronger tomorrow')),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList.list(children: [
            Card(child: ListTile(leading: const Icon(Icons.business, color: AppColors.green), title: const Text('Business View', style: TextStyle(fontSize: 11)), subtitle: const Text('Master View', style: TextStyle(fontWeight: FontWeight.w800)), trailing: const Icon(Icons.keyboard_arrow_down))),
            const SizedBox(height: 14),
            SizedBox(height: 220, child: GridView.count(physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.55, children: const [
              MetricCard(label: 'Today Sales', value: 'Rs 2,480,500', icon: Icons.point_of_sale, caption: '↑ 12% vs yesterday'),
              MetricCard(label: 'Cash Position', value: 'Rs 1,320,000', icon: Icons.account_balance_wallet_outlined, caption: '↑ 8% vs yesterday'),
              MetricCard(label: 'Receivables', value: 'Rs 3,750,000', icon: Icons.groups_outlined, tint: Colors.orange, caption: '12 payments due'),
              MetricCard(label: 'Pending Approvals', value: '24', icon: Icons.fact_check_outlined, tint: Colors.blue, caption: '6 new requests'),
            ])),
            const SizedBox(height: 16),
            const SectionTitle('Business Overview', action: 'Last 7 Days'),
            const SizedBox(height: 8),
            Card(child: SizedBox(height: 150, child: Padding(padding: const EdgeInsets.all(16), child: _Bars()))),
            const SizedBox(height: 16),
            const SectionTitle('Attention Required'),
            const SizedBox(height: 8),
            const Card(child: Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Column(children: [
              StatusRow(title: 'Low Stock', subtitle: '8 items below minimum level', status: 'Review', color: Colors.orange, icon: Icons.warning_amber),
              Divider(height: 1),
              StatusRow(title: 'Payment Due', subtitle: '12 dealer payments overdue', status: 'Due', color: Colors.red, icon: Icons.payments_outlined),
              Divider(height: 1),
              StatusRow(title: 'Staff Requests', subtitle: '3 access requests pending', status: 'Approve', color: Colors.blue, icon: Icons.people_outline),
            ]))),
          ]),
        ),
      ]);
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
