import 'package:flutter/material.dart';

import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class StaffDashboard extends StatelessWidget {
  const StaffDashboard({super.key, required this.profile});
  final AppProfile profile;
  @override
  Widget build(BuildContext context) => CustomScrollView(slivers: [
    SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Teamwork grows progress', badge: 'Sales Staff')),
    SliverPadding(padding: const EdgeInsets.all(16), sliver: SliverList.list(children: [
      const SizedBox(height: 220, child: GridView.count(physics: NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.55, children: [
        MetricCard(label: 'My Work', value: '8', icon: Icons.assignment_outlined, caption: 'Assigned tasks'),
        MetricCard(label: 'Today Orders', value: '12', icon: Icons.shopping_cart_outlined, caption: 'Rs 285,400'),
        MetricCard(label: 'Pending Delivery', value: '5', icon: Icons.local_shipping_outlined, tint: Colors.orange, caption: 'Orders'),
        MetricCard(label: 'Stock Request', value: '3', icon: Icons.inventory_2_outlined, tint: Colors.blue, caption: 'Items'),
      ])),
      const SizedBox(height: 16), const SectionTitle("Today's Tasks"), const SizedBox(height: 8),
      const Card(child: Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Column(children: [
        StatusRow(title: 'Visit Al-Farooq Dairy', subtitle: 'Gulberg, Faisalabad • 09:00 AM', status: 'Completed'), Divider(height: 1),
        StatusRow(title: 'Take Order — Chaudhry Feed Store', subtitle: 'D-Ground • 11:30 AM', status: 'In Progress', color: Colors.blue), Divider(height: 1),
        StatusRow(title: 'Deliver — Rana Traders', subtitle: 'Samanabad • 02:00 PM', status: 'Pending', color: Colors.orange), Divider(height: 1),
        StatusRow(title: 'Collect Payment — Usman Agro', subtitle: 'Jaranwala Road • 04:00 PM', status: 'Pending', color: Colors.orange),
      ]))),
      const SizedBox(height: 14),
      Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFFFFF8E7), border: Border.all(color: AppColors.gold), borderRadius: BorderRadius.circular(16)), child: const Row(children: [Icon(Icons.campaign_outlined, color: AppColors.gold), SizedBox(width: 10), Expanded(child: Text('Sirf assigned branch aur shop\nApni assigned branch aur allowed shops tak hi kaam karein.', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)))])),
    ]))
  ]);
}
