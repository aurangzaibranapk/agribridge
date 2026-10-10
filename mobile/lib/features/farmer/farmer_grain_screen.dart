import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';
import 'farmer_services_screen.dart';

class FarmerGrainScreen extends ConsumerWidget {
  const FarmerGrainScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(farmerGrainSummaryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mera Grain / Procurement')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(farmerGrainSummaryProvider.future).then((_) {}),
        child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(16), children: [
          state.when(
            loading: () => const Card(child: ListTile(title: Text('Grain record load ho raha hai…'))),
            error: (_, __) => Card(child: ListTile(title: const Text('Grain record load nahi hua.'), trailing: TextButton(onPressed: () => ref.invalidate(farmerGrainSummaryProvider), child: const Text('Retry')))),
            data: (data) => _content(context, data),
          ),
        ]),
      ),
    );
  }

  Widget _content(BuildContext context, Map<String, dynamic> data) {
    final entries = List<Map<String, dynamic>>.from(data['entries'] as List? ?? const []);
    final payments = List<Map<String, dynamic>>.from(data['payments'] as List? ?? const []);
    String money(dynamic value) => 'Rs ${NumberFormat('#,##0').format((value as num?) ?? 0)}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
        _amountRow('Grain value', money(data['total_supplied'])),
        _amountRow('Paid', money(data['total_paid'])),
        const Divider(),
        _amountRow('Payment due', money(data['balance_due']), strong: true),
      ]))),
      const SizedBox(height: 14),
      FilledButton.icon(
        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FarmerServicesScreen())),
        icon: const Icon(Icons.add),
        label: const Text('Grain sale request'),
      ),
      const SizedBox(height: 18),
      const Text('Procurement entries', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      if (entries.isEmpty) const Card(child: ListTile(title: Text('Abhi koi grain entry nahi.')))
      else ...entries.map((row) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
        leading: const Icon(Icons.grass_outlined, color: AppColors.green),
        title: Text('${row['grain_type'] ?? 'Grain'} • ${row['weight_kg'] ?? 0} kg'),
        subtitle: Text('${row['date'] ?? ''} • Rate ${money(row['rate_per_kg'])}/kg'),
        trailing: Text(money(row['total_amount']), style: const TextStyle(fontWeight: FontWeight.w800)),
      )))),
      const SizedBox(height: 16),
      const Text('Payments', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      if (payments.isEmpty) const Card(child: ListTile(title: Text('Abhi koi payment record nahi.')))
      else ...payments.map((row) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
        leading: const Icon(Icons.payments_outlined, color: AppColors.green),
        title: Text(money(row['amount'])),
        subtitle: Text('${row['date'] ?? ''} • ${row['method'] ?? 'Payment'}'),
      )))),
      const SizedBox(height: 80),
    ]);
  }

  Widget _amountRow(String label, String value, {bool strong = false}) =>
    Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
      Expanded(child: Text(label)),
      Text(value, style: TextStyle(fontWeight: strong ? FontWeight.w900 : FontWeight.w600, color: strong ? AppColors.green : AppColors.ink)),
    ]));
}
