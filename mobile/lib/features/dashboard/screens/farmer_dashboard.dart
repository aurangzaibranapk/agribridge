import 'package:flutter/material.dart';

import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class FarmerDashboard extends StatelessWidget {
  const FarmerDashboard({super.key, required this.profile});
  final AppProfile profile;

  @override
  Widget build(BuildContext context) => CustomScrollView(slivers: [
        SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Aapki mehnat, hamara saath')),
        SliverPadding(padding: const EdgeInsets.all(16), sliver: SliverList.list(children: [
          Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.green, AppColors.deepGreen]), borderRadius: BorderRadius.circular(20)), child: const Row(children: [
            CircleAvatar(backgroundColor: Colors.white24, child: Icon(Icons.account_balance_wallet_outlined, color: Colors.white)), SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Mera Khata', style: TextStyle(color: Colors.white70, fontSize: 12)), Text('Rs 28,450', style: TextStyle(color: Colors.white, fontSize: 27, fontWeight: FontWeight.w800)), Text('Aap ka current balance', style: TextStyle(color: Colors.white70, fontSize: 10))])),
            Icon(Icons.chevron_right, color: Colors.white),
          ])),
          const SizedBox(height: 14),
          GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.1, children: const [
            QuickAction(label: 'Milk Payment', icon: Icons.water_drop_outlined),
            QuickAction(label: 'FMCG Khata', icon: Icons.shopping_cart_outlined),
            QuickAction(label: 'Machinery Booking', icon: Icons.agriculture_outlined),
            QuickAction(label: 'Grain Sale', icon: Icons.grass_outlined),
          ]),
          const SizedBox(height: 16),
          const SectionTitle('Aaj ka Doodh Record'), const SizedBox(height: 8),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _MilkValue('120', 'Litres', Icons.local_drink_outlined), _MilkValue('3.8%', 'Fat', Icons.water_drop_outlined), _MilkValue('Rs 220', 'Rate/Litre', Icons.payments_outlined), _MilkValue('Wed', 'Payment', Icons.calendar_month_outlined),
          ]))),
          const SizedBox(height: 16),
          const SectionTitle('Aaj ka Mausam', action: 'Faisalabad'), const SizedBox(height: 8),
          const Card(child: ListTile(leading: Icon(Icons.wb_sunny_rounded, color: Colors.orange, size: 38), title: Text('28°C • Mostly Sunny', style: TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('High 32°C  •  Low 18°C\nKoi barish ka imkaan nahi'), trailing: Icon(Icons.eco, color: AppColors.green))),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.smart_toy_outlined), label: const Text('Kisan AI — Apna sawal poochain'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56))),
          const SizedBox(height: 90),
        ]))
      ]);
}

class _MilkValue extends StatelessWidget {
  const _MilkValue(this.value, this.label, this.icon);
  final String value; final String label; final IconData icon;
  @override Widget build(BuildContext context) => Column(children: [Icon(icon, color: AppColors.green), const SizedBox(height: 5), Text(value, style: const TextStyle(fontWeight: FontWeight.w800)), Text(label, style: const TextStyle(fontSize: 9, color: AppColors.muted))]);
}
