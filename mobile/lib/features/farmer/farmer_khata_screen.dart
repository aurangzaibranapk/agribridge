import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class FarmerKhataScreen extends StatefulWidget {
  const FarmerKhataScreen({super.key});
  @override State<FarmerKhataScreen> createState() => _FarmerKhataScreenState();
}

class _FarmerKhataScreenState extends State<FarmerKhataScreen> {
  String filter = 'All';
  final rows = const [
    ('Milk', 'Weekly milk payment', 42850.0, true, '10 Sep 2026'),
    ('FMCG', 'Karyana purchase', 6240.0, false, '09 Sep 2026'),
    ('Machinery', 'Rice harvester advance', 15000.0, false, '07 Sep 2026'),
    ('Grain', 'Wheat sale payment', 87500.0, true, '04 Sep 2026'),
    ('Fertilizer', 'Engro Urea × 4', 16880.0, false, '02 Sep 2026'),
  ];
  @override Widget build(BuildContext context) {
    final visible = rows.where((r) => filter == 'All' || r.$1 == filter).toList();
    return Scaffold(appBar: AppBar(title: const Text('Mera Khata')), body: Column(children: [
      Container(margin: const EdgeInsets.all(16), padding: const EdgeInsets.all(18), decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.green, AppColors.deepGreen]), borderRadius: BorderRadius.circular(18)), child: const Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Current Balance', style: TextStyle(color: Colors.white70)), Text('Rs 28,450', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900))])), Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 38)])),
      SizedBox(height: 40, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: ['All','Milk','FMCG','Fertilizer','Grain','Machinery'].map((v) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(v), selected: filter == v, onSelected: (_) => setState(() => filter = v)))).toList())),
      const SizedBox(height: 8),
      Expanded(child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: visible.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final r = visible[i];
          return Card(child: ListTile(
            leading: CircleAvatar(
              backgroundColor: (r.$4 ? Colors.green : Colors.orange).withValues(alpha: .1),
              child: Icon(r.$4 ? Icons.south_west : Icons.north_east, color: r.$4 ? Colors.green : Colors.orange),
            ),
            title: Text(r.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('${r.$1} • ${r.$5}'),
            trailing: Text(
              '${r.$4 ? '+' : '-'} Rs ${r.$3.toStringAsFixed(0)}',
              style: TextStyle(fontWeight: FontWeight.w800, color: r.$4 ? Colors.green : Colors.red),
            ),
          ));
        },
      )),
    ]));
  }
}
