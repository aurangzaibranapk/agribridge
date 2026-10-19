import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';

/// Dukaan ke bill: 572 (fn_my_bills). Read-only.
class FarmerBillsScreen extends ConsumerWidget {
  const FarmerBillsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(billsProvider);
    final money = NumberFormat('#,##0');
    return Scaffold(
      appBar: AppBar(title: const Text('Mere Bill')),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: TextButton.icon(onPressed: () => ref.invalidate(billsProvider), icon: const Icon(Icons.refresh), label: const Text('Dobara load karein'))),
        data: (rows) => rows.isEmpty
            ? const Center(child: Text('Koi bill nahi mila.'))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(billsProvider.future).then((_) {}),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: rows.length,
                  itemBuilder: (_, i) {
                    final bill = rows[i];
                    final items = List<Map<String, dynamic>>.from((bill['items'] as List?) ?? const []);
                    final khata = (bill['khata'] as num?) ?? 0;
                    return Card(child: ExpansionTile(
                      title: Text('${bill['ref'] ?? ''}  •  Rs ${money.format((bill['total'] as num?) ?? 0)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text('${bill['date'] ?? ''}${khata > 0 ? '  •  Udhaar Rs ${money.format(khata)}' : ''}'),
                      children: [
                        for (final item in items)
                          ListTile(dense: true, title: Text(item['name']?.toString() ?? ''), subtitle: Text('${item['qty']} x Rs ${item['rate']}'), trailing: Text('Rs ${money.format((item['amount'] as num?) ?? 0)}')),
                      ],
                    ));
                  },
                ),
              ),
      ),
    );
  }
}
