import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';
import 'farmer_services_screen.dart';

/// Confirmed ERP bookings only. New enquiries remain in Farmer Services.
class FarmerMachineryScreen extends ConsumerWidget {
  const FarmerMachineryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(farmerMachineryBookingsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Meri Machinery')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(farmerMachineryBookingsProvider.future).then((_) {}),
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppColors.mint, borderRadius: BorderRadius.circular(18)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Booking aur request alag hain', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              const Text('Yahan ERP mein confirm hui bookings aur record ki hui raqam nazar aati hai. Nayi machinery request bhejne ke liye neeche button dabayen.'),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FarmerServicesScreen())),
                icon: const Icon(Icons.add),
                label: const Text('Nayi request'),
              ),
            ]),
          ),
          const SizedBox(height: 18),
          const Text('Meri Bookings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          state.when(
            loading: () => const Card(child: ListTile(title: Text('Bookings load ho rahi hain…'))),
            error: (_, __) => Card(child: ListTile(title: const Text('Bookings load nahi huin.'), trailing: TextButton(onPressed: () => ref.invalidate(farmerMachineryBookingsProvider), child: const Text('Retry')))),
            data: (rows) => rows.isEmpty
              ? const Card(child: ListTile(title: Text('Abhi koi confirmed ERP booking nahi.'), subtitle: Text('Aap ki bheji hui requests Services mein milengi.')))
              : Column(children: rows.map((row) => _booking(row)).toList()),
          ),
          const SizedBox(height: 90),
        ]),
      ),
    );
  }

  Widget _booking(Map<String, dynamic> row) {
    final total = (row['total_amount'] as num?) ?? 0;
    final paid = (row['amount_received'] as num?) ?? 0;
    final remaining = total - paid;
    final date = row['work_date']?.toString() ?? row['booking_date']?.toString() ?? '';
    String amount(num value) => 'Rs ${NumberFormat('#,##0').format(value)}';
    return Padding(padding: const EdgeInsets.only(bottom: 10), child: Card(child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(row['booking_number']?.toString() ?? 'Booking', style: const TextStyle(fontWeight: FontWeight.w800))),
          Text((row['status']?.toString() ?? 'pending').replaceAll('_', ' '), style: const TextStyle(color: AppColors.green, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 6),
        Text('${row['machine_type'] ?? 'Machine'} • ${row['acres'] ?? '—'} acres', style: const TextStyle(fontWeight: FontWeight.w600)),
        if (date.isNotEmpty) Text('Date: $date', style: const TextStyle(color: AppColors.muted)),
        if ((row['location']?.toString() ?? '').isNotEmpty) Text('Village: ${row['location']}'),
        const Divider(height: 22),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Total recorded'), Text(amount(total))]),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Received'), Text(amount(paid))]),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Remaining'), Text(total > 0 ? amount(remaining) : 'Bill pending', style: const TextStyle(fontWeight: FontWeight.w800))]),
      ]),
    )));
  }
}
