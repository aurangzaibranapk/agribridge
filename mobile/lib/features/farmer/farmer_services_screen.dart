import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

class FarmerServicesScreen extends ConsumerWidget {
  const FarmerServicesScreen({super.key});
  @override Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(farmerSummaryProvider);
    if (state.isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (state.hasError) return Scaffold(appBar: AppBar(title: const Text('Farmer Services')), body: Center(child: TextButton.icon(onPressed: () => ref.invalidate(farmerSummaryProvider), icon: const Icon(Icons.refresh), label: const Text('Data dobara load karein'))));
    final summary = state.valueOrNull ?? const <String, dynamic>{};
    String value(String key, {String suffix = ''}) => '${(summary[key] as num?)?.toStringAsFixed(1) ?? '0'}$suffix';
    return Scaffold(appBar: AppBar(title: const Text('Farmer Services')), body: ListView(padding: const EdgeInsets.all(16), children: [
    const SectionTitle('Milk Collection', action: 'Full Statement'), const SizedBox(height: 8),
    Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
      const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('This Week', style: TextStyle(fontWeight: FontWeight.w800)), Text('Payment: Wednesday', style: TextStyle(color: AppColors.green, fontWeight: FontWeight.w700))]), const Divider(height: 24),
      Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [_Value(value('week_liters', suffix: ' L'),'Milk'), _Value(value('avg_fat', suffix: '%'),'Avg Fat'), _Value(value('avg_snf', suffix: '%'),'Avg SNF'), _Value('Rs ${((summary['week_amount'] as num?) ?? 0).toStringAsFixed(0)}','Amount')]),
    ]))),
    const SizedBox(height: 18), const SectionTitle('Book a Service', action: ''), const SizedBox(height: 8),
    QuickAction(label: 'Machinery Booking', icon: Icons.agriculture_outlined, onTap: () => _booking(context)), const SizedBox(height: 10),
    QuickAction(label: 'Grain Sale Request', icon: Icons.grass_outlined, onTap: () => _grain(context)), const SizedBox(height: 10),
    const QuickAction(label: 'Veterinary Service', icon: Icons.pets_outlined), const SizedBox(height: 10),
    const QuickAction(label: 'Crop Doctor', icon: Icons.health_and_safety_outlined), const SizedBox(height: 18),
    Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: AppColors.mint, borderRadius: BorderRadius.circular(18)), child: const Row(children: [CircleAvatar(backgroundColor: AppColors.green, child: Icon(Icons.smart_toy_outlined, color: Colors.white)), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Kisan AI', style: TextStyle(fontWeight: FontWeight.w800)), Text('Fasal, spray, mausam ya janwaron ke bare mein poochain.', style: TextStyle(fontSize: 11, color: AppColors.muted))])), Icon(Icons.chevron_right)])),
  ]));
  }

  void _booking(BuildContext context) => showModalBottomSheet(context: context, isScrollControlled: true, builder: (_) => const _RequestSheet(title: 'Machinery Booking', fields: ['Machine', 'Acres', 'Required Date', 'Farm Location']));
  void _grain(BuildContext context) => showModalBottomSheet(context: context, isScrollControlled: true, builder: (_) => const _RequestSheet(title: 'Grain Sale Request', fields: ['Crop', 'Expected Bags', 'Expected Date', 'Pickup Location']));
}

class _Value extends StatelessWidget { const _Value(this.value,this.label); final String value,label; @override Widget build(BuildContext context) => Column(children: [Text(value, style: const TextStyle(fontWeight: FontWeight.w900)), Text(label, style: const TextStyle(fontSize: 9, color: AppColors.muted))]); }

class _RequestSheet extends StatelessWidget {
  const _RequestSheet({required this.title, required this.fields}); final String title; final List<String> fields;
  @override Widget build(BuildContext context) => Padding(padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.viewInsetsOf(context).bottom + 20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 16), ...fields.map((f) => Padding(padding: const EdgeInsets.only(bottom: 10), child: TextField(decoration: InputDecoration(labelText: f)))), FilledButton(onPressed: () => Navigator.pop(context), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)), child: const Text('Request Submit Karein'))]));
}
