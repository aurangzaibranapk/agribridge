import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';
import 'khata_model.dart';

/// "Mera Khata" -- main ka ek hi khata (565): fn_my_khata_summary + fn_my_khata_statement.
class FarmerKhataScreen extends ConsumerStatefulWidget {
  const FarmerKhataScreen({super.key, this.initialFilter = 'all'});
  final String initialFilter;
  @override ConsumerState<FarmerKhataScreen> createState() => _FarmerKhataScreenState();
}

class _FarmerKhataScreenState extends ConsumerState<FarmerKhataScreen> {
  late String filter = widget.initialFilter;
  static final _money = NumberFormat('#,##0');

  Future<void> _refresh() async {
    ref.invalidate(khataSummaryProvider);
    await ref.refresh(khataStatementProvider.future).then((_) {});
  }

  @override Widget build(BuildContext context) {
    final summaryState = ref.watch(khataSummaryProvider);
    final statementState = ref.watch(khataStatementProvider);
    final summary = summaryState.valueOrNull;
    final lines = parseStatement(statementState.valueOrNull ?? const []);
    final categories = presentCategories(lines);
    final visible = lines.where((l) => filter == 'all' || l.isOpening || l.category == filter).toList();
    final owed = (summary?['owed'] as num?)?.toDouble();
    final byCategory = List<Map<String, dynamic>>.from((summary?['by_category'] as List?) ?? const []);
    final loading = summaryState.isLoading || statementState.isLoading;
    final failed = summaryState.hasError || statementState.hasError;

    return Scaffold(
      appBar: AppBar(title: const Text('Mera Khata')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : failed
              ? Center(child: TextButton.icon(onPressed: _refresh, icon: const Icon(Icons.refresh), label: const Text('Khata dobara load karein')))
              : summary == null && lines.isEmpty
                  ? const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('Aap ka khata abhi kisi kisan ya customer record se jura nahi. Dukaan par apna phone number confirm karwayein.', textAlign: TextAlign.center)))
                  : RefreshIndicator(
                      onRefresh: _refresh,
                      child: ListView(padding: EdgeInsets.zero, children: [
                        Container(
                          margin: const EdgeInsets.all(16),
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.green, AppColors.deepGreen]), borderRadius: BorderRadius.circular(18)),
                          child: Row(children: [
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text((owed ?? 0) >= 0 ? 'Aap ke zimme baqaya' : 'Aap ka hamare zimme', style: const TextStyle(color: Colors.white70)),
                              Text('Rs ${_money.format((owed ?? 0).abs())}', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900)),
                              if (summary?['last_payment'] is Map)
                                Text('Aakhri adaigi: Rs ${_money.format(((summary!['last_payment'] as Map)['amount'] as num?) ?? 0)}', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                            ])),
                            const Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 38),
                          ]),
                        ),
                        if (byCategory.isNotEmpty)
                          SizedBox(height: 86, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
                            for (final cat in byCategory)
                              SizedBox(width: 150, child: Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(khataCategoryLabel(cat['category']?.toString() ?? ''), style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                                const SizedBox(height: 4),
                                Text('Rs ${_money.format(((cat['balance'] as num?) ?? 0).abs())}', style: TextStyle(fontWeight: FontWeight.w900, color: ((cat['balance'] as num?) ?? 0) > 0 ? Colors.red : AppColors.green)),
                              ])))),
                          ])),
                        const SizedBox(height: 8),
                        SizedBox(height: 40, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
                          for (final value in ['all', ...categories])
                            Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(value == 'all' ? 'Sab' : khataCategoryLabel(value)), selected: filter == value, onSelected: (_) => setState(() => filter = value))),
                        ])),
                        const Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text('Pichhle 90 din. Ghalti lage to dukaan par ya portal se shikayat darj karein.', style: TextStyle(fontSize: 11, color: AppColors.muted))),
                        const SizedBox(height: 8),
                        if (visible.isEmpty) const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('Is qism mein koi lakeer nahi.')))
                        else ...visible.map((line) => Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: _LineCard(line: line))),
                        const SizedBox(height: 100),
                      ]),
                    ),
    );
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.line});
  final KhataLine line;
  static final _money = NumberFormat('#,##0');

  @override Widget build(BuildContext context) {
    final payment = line.isPayment;
    final amount = payment ? line.adaigi : line.udhaar;
    return Card(child: ListTile(
      leading: CircleAvatar(backgroundColor: (payment ? Colors.green : Colors.orange).withValues(alpha: .1), child: Icon(line.isOpening ? Icons.history : payment ? Icons.south_west : Icons.north_east, color: payment ? Colors.green : Colors.orange)),
      title: Text(line.isOpening ? 'Pichhla baqaya' : (line.detail.isEmpty ? khataCategoryLabel(line.category) : line.detail), style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${khataCategoryLabel(line.category)}${line.date == null ? '' : ' • ${DateFormat('dd MMM yyyy').format(line.date!)}'} • Baqaya Rs ${_money.format(line.baqaya)}'),
      trailing: line.isOpening ? null : Text('${payment ? '-' : '+'} Rs ${_money.format(amount)}', style: TextStyle(fontWeight: FontWeight.w800, color: payment ? Colors.green : Colors.red)),
    ));
  }
}
