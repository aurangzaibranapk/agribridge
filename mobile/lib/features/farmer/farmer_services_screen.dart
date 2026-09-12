import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/config/app_config.dart';
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
    QuickAction(label: 'Machinery Booking', icon: Icons.agriculture_outlined, onTap: () => _request(context, 'machinery_booking', 'Machinery Booking', ['Machine', 'Acres', 'Required Date', 'Farm Location'])), const SizedBox(height: 10),
    QuickAction(label: 'Grain Sale Request', icon: Icons.grass_outlined, onTap: () => _request(context, 'grain_sale', 'Grain Sale Request', ['Crop', 'Expected Bags', 'Expected Date', 'Pickup Location'])), const SizedBox(height: 10),
    QuickAction(label: 'Veterinary Service', icon: Icons.pets_outlined, onTap: () => _request(context, 'veterinary_service', 'Veterinary Service', ['Animal', 'Problem', 'Preferred Date', 'Location'])), const SizedBox(height: 10),
    QuickAction(label: 'Crop Doctor', icon: Icons.health_and_safety_outlined, onTap: () => _request(context, 'crop_doctor', 'Crop Doctor', ['Crop', 'Problem', 'Acres', 'Farm Location'])), const SizedBox(height: 18),
    Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: AppColors.mint, borderRadius: BorderRadius.circular(18)), child: const Row(children: [CircleAvatar(backgroundColor: AppColors.green, child: Icon(Icons.smart_toy_outlined, color: Colors.white)), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Kisan AI', style: TextStyle(fontWeight: FontWeight.w800)), Text('Fasal, spray, mausam ya janwaron ke bare mein poochain.', style: TextStyle(fontSize: 11, color: AppColors.muted))])), Icon(Icons.chevron_right)])),
  ]));
  }

  void _request(BuildContext context, String type, String title, List<String> fields) => showModalBottomSheet(context: context, isScrollControlled: true, builder: (_) => _RequestSheet(type: type, title: title, fields: fields));
}

class _Value extends StatelessWidget { const _Value(this.value,this.label); final String value,label; @override Widget build(BuildContext context) => Column(children: [Text(value, style: const TextStyle(fontWeight: FontWeight.w900)), Text(label, style: const TextStyle(fontSize: 9, color: AppColors.muted))]); }

class _RequestSheet extends ConsumerStatefulWidget {
  const _RequestSheet({required this.type, required this.title, required this.fields});
  final String type;
  final String title;
  final List<String> fields;
  @override ConsumerState<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends ConsumerState<_RequestSheet> {
  late final List<TextEditingController> controllers = [for (final _ in widget.fields) TextEditingController()];
  bool busy = false;

  @override void dispose() {
    for (final controller in controllers) { controller.dispose(); }
    super.dispose();
  }

  Future<void> submit() async {
    if (controllers.any((controller) => controller.text.trim().isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tamam khanay bharna zaroori hain.')));
      return;
    }
    setState(() => busy = true);
    try {
      if (!AppConfig.demoMode) {
        await ref.read(mobileRepositoryProvider).submitServiceRequest(
          type: widget.type,
          details: {for (var index = 0; index < widget.fields.length; index++) widget.fields[index]: controllers[index].text.trim()},
        );
      }
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.pop(context);
      messenger.showSnackBar(SnackBar(content: Text(AppConfig.demoMode ? 'Testing preview request complete.' : 'Request submit ho gayi.')));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request submit nahi hui. Dobara koshish karein.')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override Widget build(BuildContext context) => Padding(padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.viewInsetsOf(context).bottom + 20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [Text(widget.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 16), ...List.generate(widget.fields.length, (index) => Padding(padding: const EdgeInsets.only(bottom: 10), child: TextField(controller: controllers[index], decoration: InputDecoration(labelText: widget.fields[index])))), FilledButton(onPressed: busy ? null : submit, style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)), child: Text(busy ? 'Submit ho raha hai…' : 'Request Submit Karein'))]));
}
