import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../app/providers.dart';
import '../core/money.dart';
import '../core/t.dart';
import '../core/theme.dart';
import '../data/db.dart';
import '../data/repo.dart';
import 'khata.dart';

class PurchaseScreen extends ConsumerStatefulWidget {
  const PurchaseScreen({super.key});
  @override
  ConsumerState<PurchaseScreen> createState() => _PurchaseState();
}

class _PurchaseState extends ConsumerState<PurchaseScreen> {
  Party? supplier;
  final ref_ = TextEditingController(), paid = TextEditingController();
  final lines = <CartLine>[];
  String method = 'cash';

  Future<void> _addLine() async {
    final t = useT(ref);
    final items = ref.read(itemsProvider).value ?? const [];
    Item? pick = items.firstOrNull;
    final qty = TextEditingController(text: '1'), rate = TextEditingController(text: pick == null ? '' : qtyStr(pick.buyPrice));
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButton<Item>(isExpanded: true, value: pick, items: [for (final i in items) DropdownMenuItem(value: i, child: Text(i.name))],
            onChanged: (v) => set(() { pick = v; rate.text = qtyStr(v!.buyPrice); })),
        TextField(key: const Key('pQty'), controller: qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Qty')),
        const SizedBox(height: 8),
        TextField(controller: rate, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('buy_price'))),
      ]),
      actions: [TextButton(key: const Key('pAdd'), onPressed: () => Navigator.pop(c, true), child: Text(t('add')))],
    )));
    if (ok == true && pick != null) {
      setState(() => lines.add(CartLine(pick!.copyWith(buyPrice: double.tryParse(rate.text) ?? pick!.buyPrice), double.tryParse(qty.text) ?? 1)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    final sups = ref.watch(balancesProvider('supplier')).value ?? const [];
    final total = lines.fold<double>(0, (a, l) => a + l.item.buyPrice * l.qty);
    final p = double.tryParse(paid.text) ?? 0;
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [
          InkWell(onTap: () => context.pop(), child: Text('← ${t('stock')}', style: const TextStyle(fontSize: 12, color: Colors.white70))),
          Text(t('add_purchase'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        ]),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t('supplier'), style: kMuted),
          Row(children: [
            Expanded(child: DropdownButtonFormField<Party>(
              key: const Key('supplierPick'),
              initialValue: supplier, isExpanded: true,
              items: [for (final b in sups) DropdownMenuItem(value: b.party, child: Text(b.party.name))],
              onChanged: (v) => setState(() => supplier = v),
            )),
            IconButton(onPressed: () => showPartyForm(context, ref, 'supplier'), icon: const Icon(Icons.person_add_alt_1, color: C.indigo)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(controller: ref_, decoration: InputDecoration(labelText: t('bill_no')))),
            const SizedBox(width: 8),
            Expanded(child: InputDecorator(decoration: const InputDecoration(), child: Text(DateFormat('dd-MM-yyyy').format(DateTime.now())))),
          ]),
        ])),
        AppCard(child: Column(children: [
          Row(children: [Expanded(child: Text(t('items'), style: kBold)), TextButton(key: const Key('addLine'), onPressed: _addLine, child: Text('+ ${t('add')}'))]),
          for (final (i, l) in lines.indexed)
            Li(last: i == lines.length - 1,
                left: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(l.item.name, style: const TextStyle(fontSize: 13)), Text('${qtyStr(l.qty)} × ${rs(l.item.buyPrice)}', style: kMuted)]),
                right: Text(rs(l.qty * l.item.buyPrice), style: kBold)),
        ])),
        AppCard(child: Column(children: [
          Li(left: Text(t('total')), right: Text(rs(total), style: kBold)),
          Li(left: Text(t('paid_now')), right: SizedBox(width: 120, child: TextField(key: const Key('paidNow'), controller: paid, onChanged: (_) => setState(() {}), keyboardType: TextInputType.number, textAlign: TextAlign.end, decoration: const InputDecoration(prefixText: 'Rs ')))),
          Wrap(children: [for (final m in ['cash', 'jazzcash', 'easypaisa', 'bank']) Pill(t('m_$m'), on: method == m, onTap: () => setState(() => method = m))]),
          Li(last: true, left: Text(t('remaining_supplier')), right: Text(rs(math.max(0, total - p)), style: const TextStyle(fontWeight: FontWeight.w700, color: C.coral))),
        ])),
        GradButton(t('save_purchase'), key: const Key('savePurchase'), onTap: lines.isEmpty ? null : () async {
          await ref.read(repoProvider).createPurchase(partyId: supplier?.id, refNo: ref_.text.trim().isEmpty ? null : ref_.text.trim(), lines: lines, paid: math.min(p, total), method: method);
          if (context.mounted) context.pop();
        }),
        const SizedBox(height: 24),
      ]),
    );
  }
}
