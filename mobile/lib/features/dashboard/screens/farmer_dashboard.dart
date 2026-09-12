import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/data/mobile_providers.dart';
import '../../../core/models/app_role.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class FarmerDashboard extends ConsumerWidget {
  const FarmerDashboard({super.key, required this.profile});
  final AppProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(farmerSummaryProvider);
    final data = state.valueOrNull;
    final wallet = (data?['wallet_balance'] as num?)?.toDouble();
    final litres = (data?['week_liters'] as num?)?.toDouble();
    final fat = (data?['avg_fat'] as num?)?.toDouble();
    final amount = (data?['week_amount'] as num?)?.toDouble();

    return RefreshIndicator(
      onRefresh: () => ref.refresh(farmerSummaryProvider.future).then((_) {}),
      child: CustomScrollView(slivers: [
        SliverToBoxAdapter(child: BrandHeader(name: profile.name, subtitle: 'Aapki mehnat, hamara saath')),
        SliverPadding(padding: const EdgeInsets.all(16), sliver: SliverList.list(children: [
          if (state.hasError)
            Card(color: const Color(0xFFFFF4E5), child: ListTile(leading: const Icon(Icons.warning_amber, color: Colors.orange), title: const Text('Farmer data load nahi hua.'), trailing: TextButton(onPressed: () => ref.invalidate(farmerSummaryProvider), child: const Text('Retry')))),
          Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.green, AppColors.deepGreen]), borderRadius: BorderRadius.circular(20)), child: Row(children: [
            const CircleAvatar(backgroundColor: Colors.white24, child: Icon(Icons.account_balance_wallet_outlined, color: Colors.white)), const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Mera Khata', style: TextStyle(color: Colors.white70, fontSize: 12)),
              Text(state.isLoading ? 'Load ho raha hai…' : wallet == null ? 'Data available nahi' : 'Rs ${NumberFormat('#,##0').format(wallet)}', style: const TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w800)),
              const Text('Aap ka current wallet balance', style: TextStyle(color: Colors.white70, fontSize: 10)),
            ])),
            const Icon(Icons.chevron_right, color: Colors.white),
          ])),
          const SizedBox(height: 14),
          GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.1, children: const [
            QuickAction(label: 'Milk Payment', icon: Icons.water_drop_outlined),
            QuickAction(label: 'FMCG Khata', icon: Icons.shopping_cart_outlined),
            QuickAction(label: 'Machinery Booking', icon: Icons.agriculture_outlined),
            QuickAction(label: 'Grain Sale', icon: Icons.grass_outlined),
          ]),
          const SizedBox(height: 16),
          const SectionTitle('Is haftay ka Doodh Record'), const SizedBox(height: 8),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _MilkValue(litres == null ? '—' : NumberFormat('#,##0.0').format(litres), 'Litres', Icons.local_drink_outlined),
            _MilkValue(fat == null ? '—' : '${fat.toStringAsFixed(1)}%', 'Avg Fat', Icons.water_drop_outlined),
            _MilkValue(amount == null ? '—' : 'Rs ${NumberFormat.compact().format(amount)}', 'Amount', Icons.payments_outlined),
            const _MilkValue('Wed', 'Payment', Icons.calendar_month_outlined),
          ]))),
          const SizedBox(height: 16),
          const Card(child: ListTile(leading: Icon(Icons.cloud_outlined, color: AppColors.green, size: 34), title: Text('Mausam service', style: TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('Verified location aur weather feed configure hone par yahan live forecast nazar ayega.'))),
          const SizedBox(height: 90),
        ]))),
      ]),
    );
  }
}

class _MilkValue extends StatelessWidget {
  const _MilkValue(this.value, this.label, this.icon);
  final String value;
  final String label;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Column(children: [Icon(icon, color: AppColors.green), const SizedBox(height: 5), Text(value, style: const TextStyle(fontWeight: FontWeight.w800)), Text(label, style: const TextStyle(fontSize: 9, color: AppColors.muted))]);
}
