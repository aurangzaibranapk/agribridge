import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';

class FarmerKhataScreen extends ConsumerStatefulWidget {
  const FarmerKhataScreen({super.key});
  @override ConsumerState<FarmerKhataScreen> createState() => _FarmerKhataScreenState();
}

class _FarmerKhataScreenState extends ConsumerState<FarmerKhataScreen> {
  String filter = 'All';

  @override Widget build(BuildContext context) {
    final state = ref.watch(farmerSummaryProvider);
    final data = state.valueOrNull;
    final rows = List<Map<String, dynamic>>.from((data?['transactions'] as List?) ?? const []);
    final visible = rows.where((row) => filter == 'All' || row['category'] == filter).toList();
    final wallet = (data?['wallet_balance'] as num?)?.toDouble() ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text('Mera Khata')),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.hasError
              ? Center(child: TextButton.icon(onPressed: () => ref.invalidate(farmerSummaryProvider), icon: const Icon(Icons.refresh), label: const Text('Khata dobara load karein')))
              : RefreshIndicator(
                  onRefresh: () => ref.refresh(farmerSummaryProvider.future).then((_) {}),
                  child: ListView(padding: EdgeInsets.zero, children: [
                    Container(margin: const EdgeInsets.all(16), padding: const EdgeInsets.all(18), decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.green, AppColors.deepGreen]), borderRadius: BorderRadius.circular(18)), child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Wallet Balance', style: TextStyle(color: Colors.white70)), Text('Rs ${NumberFormat('#,##0').format(wallet)}', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900))])),
                      const Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 38),
                    ])),
                    Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: [
                      Expanded(child: _BalanceCard(label: 'Milk Due', amount: (data?['milk_balance'] as num?)?.toDouble() ?? 0, positive: true)),
                      const SizedBox(width: 10),
                      Expanded(child: _BalanceCard(label: 'Credit Due', amount: (data?['credit_balance'] as num?)?.toDouble() ?? 0, positive: false)),
                    ])),
                    const SizedBox(height: 14),
                    SizedBox(height: 40, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: ['All','Milk','FMCG','Fertilizer','Pesticide','Grain','Machinery','Seed'].map((value) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(value), selected: filter == value, onSelected: (_) => setState(() => filter = value)))).toList())),
                    const SizedBox(height: 8),
                    if (visible.isEmpty) const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('Is category mein koi transaction nahi.')))
                    else ...visible.map((row) => Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: _TransactionCard(row: row))),
                    const SizedBox(height: 100),
                  ]),
                ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.label, required this.amount, required this.positive});
  final String label; final double amount; final bool positive;
  @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)), const SizedBox(height: 4), Text('Rs ${NumberFormat('#,##0').format(amount)}', style: TextStyle(fontWeight: FontWeight.w900, color: positive ? AppColors.green : Colors.red))])));
}

class _TransactionCard extends StatelessWidget {
  const _TransactionCard({required this.row});
  final Map<String, dynamic> row;
  @override Widget build(BuildContext context) {
    final incoming = row['incoming'] == true;
    final amount = (row['amount'] as num?)?.toDouble() ?? 0;
    final date = DateTime.tryParse(row['happened_at']?.toString() ?? '');
    return Card(child: ListTile(
      leading: CircleAvatar(backgroundColor: (incoming ? Colors.green : Colors.orange).withValues(alpha: .1), child: Icon(incoming ? Icons.south_west : Icons.north_east, color: incoming ? Colors.green : Colors.orange)),
      title: Text(row['title']?.toString() ?? 'Transaction', style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${row['category'] ?? 'Other'}${date == null ? '' : ' • ${DateFormat('dd MMM yyyy').format(date.toLocal())}'}'),
      trailing: Text('${incoming ? '+' : '-'} Rs ${NumberFormat('#,##0').format(amount)}', style: TextStyle(fontWeight: FontWeight.w800, color: incoming ? Colors.green : Colors.red)),
    ));
  }
}
