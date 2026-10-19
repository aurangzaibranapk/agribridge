import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';
import 'farmer_services_screen.dart';

/// Canonical ERP booking records, including cancelled work. New enquiries remain in Farmer Services.
class FarmerMachineryScreen extends ConsumerWidget {
  const FarmerMachineryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(farmerMachineryBookingsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Meri Machinery')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(farmerMachineryBookingsProvider.future).then((_) {}),
        child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(16), children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppColors.mint, borderRadius: BorderRadius.circular(18)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Booking aur request alag hain', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              const Text('Yahan ERP bookings (cancelled bhi) aur record ki hui raqam nazar aati hai. Nayi machinery request bhejne ke liye neeche button dabayen.'),
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
              ? const Card(child: ListTile(title: Text('Abhi koi ERP booking nahi.'), subtitle: Text('Aap ki bheji hui requests Services mein milengi.')))
              : Column(children: rows.map((row) => _booking(row)).toList()),
          ),
          const SizedBox(height: 90),
        ]),
      ),
    );
  }

  Widget _booking(Map<String, dynamic> row) {
    num asAmount(dynamic value) => value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;
    String amount(num value) => 'Rs ${NumberFormat('#,##0').format(value)}';
    final total = asAmount(row['total_amount']);
    final recorded = asAmount(row['amount_received']);
    final payments = (row['payments'] as List? ?? const [])
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
    final diesel = (row['diesel'] as List? ?? const [])
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
    final verifiedSum = payments.fold<num>(0, (sum, entry) => sum + asAmount(entry['amount']));
    final mismatch = payments.isNotEmpty && (verifiedSum - recorded).abs() > 0.01;
    final date = row['work_date']?.toString() ?? row['booking_date']?.toString() ?? '';
    String payer(String? value) => switch (value) {
      'farmer' => 'Farmer',
      'vendor' => 'Vendor',
      'company' => 'ART',
      _ => value ?? 'Unknown',
    };
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
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Booking amount'), Text(total > 0 ? amount(total) : 'Bill pending')]),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Booking recorded received'), Text(amount(recorded))]),
        if (!mismatch)
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Remaining'),
            Text(total > 0 ? amount(total - recorded) : 'Bill pending', style: const TextStyle(fontWeight: FontWeight.w800)),
          ]),
        if (mismatch) ...[
          const SizedBox(height: 8),
          Text('Verified payment entries: ${amount(verifiedSum)}', style: const TextStyle(fontWeight: FontWeight.w700)),
          const Text('Payment entries aur booking total match nahi karte. Office se hisaab milwayein; final balance abhi nahi dikhaya gaya.', style: TextStyle(color: AppColors.muted)),
        ],
        if (payments.isNotEmpty) ...[
          const Divider(height: 22),
          const Text('Verified payments', style: TextStyle(fontWeight: FontWeight.w800)),
          for (final entry in payments)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text('${entry['kind'] == 'advance' ? 'Advance' : 'Payment'} • ${entry['date'] ?? ''}'),
              subtitle: Text('Method: ${entry['method'] ?? '—'}'),
              trailing: Text(amount(asAmount(entry['amount']))),
            ),
        ],
        if (diesel.isNotEmpty) ...[
          const Divider(height: 22),
          const Text('Verified diesel record', style: TextStyle(fontWeight: FontWeight.w800)),
          for (final entry in diesel)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text('${entry['litres'] ?? '—'} litres • ${entry['date'] ?? ''}'),
              subtitle: Text('Diya: ${payer(entry['paid_by']?.toString())}'),
              trailing: Text(amount(asAmount(entry['amount']))),
            ),
          const Text('Diesel ki raqam automatic farmer balance mein shamil nahi ki gayi.', style: TextStyle(color: AppColors.muted)),
        ],
      ]),
    )));
  }
}
