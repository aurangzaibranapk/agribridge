import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

/// Doodh aur janwar: 567 (fn_my_milk_collection) + 571 (fn_my_due_tasks). Read-only.
class FarmerDairyScreen extends ConsumerWidget {
  const FarmerDairyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final milk = ref.watch(milkCollectionProvider);
    final tasks = ref.watch(dueTasksProvider);
    final litres = NumberFormat('#,##0.0');
    return Scaffold(
      appBar: AppBar(title: const Text('Doodh aur Janwar')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dueTasksProvider);
          await ref.refresh(milkCollectionProvider.future).then((_) {});
        },
        child: ListView(padding: const EdgeInsets.all(16), children: [
          const SectionTitle('Aane wale kaam (30 din)'),
          const SizedBox(height: 8),
          tasks.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())),
            error: (_, __) => const Card(child: ListTile(leading: Icon(Icons.warning_amber, color: Colors.orange), title: Text('Kaam load nahi hue'))),
            data: (rows) => rows.isEmpty
                ? const Card(child: ListTile(leading: Icon(Icons.check_circle_outline, color: AppColors.green), title: Text('Koi kaam baqi nahi')))
                : Column(children: [
                    for (final row in rows)
                      Card(child: ListTile(
                        leading: Icon(Icons.pets_outlined, color: row['severity'] == 'overdue' ? Colors.red : AppColors.green),
                        title: Text(row['task']?.toString() ?? 'Kaam', style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text([row['tag_no'], row['animal_name']].where((v) => v != null && '$v'.isNotEmpty).join(' • ')),
                        trailing: Text(row['due_date']?.toString() ?? ''),
                      )),
                  ]),
          ),
          const SizedBox(height: 16),
          const SectionTitle('Markaz par diya doodh (30 din)'),
          const SizedBox(height: 8),
          milk.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())),
            error: (_, __) => const Card(child: ListTile(leading: Icon(Icons.warning_amber, color: Colors.orange), title: Text('Doodh ka record load nahi hua'))),
            data: (rows) => rows.isEmpty
                ? const Card(child: ListTile(title: Text('Is mahine koi doodh record nahi')))
                : Column(children: [
                    for (final row in rows.reversed)
                      Card(child: ListTile(
                        leading: const Icon(Icons.water_drop_outlined, color: AppColors.green),
                        title: Text(row['entry_date']?.toString() ?? ''),
                        subtitle: Text('Subah ${litres.format((row['am'] as num?) ?? 0)} L • Shaam ${litres.format((row['pm'] as num?) ?? 0)} L'),
                        trailing: Text('${litres.format((row['total'] as num?) ?? 0)} L', style: const TextStyle(fontWeight: FontWeight.w800)),
                      )),
                  ]),
          ),
          const SizedBox(height: 12),
          const Text('Janwar, breeding aur munafa/nuqsan ki poori tafseel website portal par.', style: TextStyle(fontSize: 11, color: AppColors.muted)),
          const SizedBox(height: 90),
        ]),
      ),
    );
  }
}
