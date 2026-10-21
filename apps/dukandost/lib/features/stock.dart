import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../app/providers.dart';
import '../core/money.dart';
import '../core/t.dart';
import '../core/theme.dart';
import '../data/db.dart';

bool isLow(Item i) => i.lowStockAt > 0 && i.stock <= i.lowStockAt;

class StockTab extends ConsumerStatefulWidget {
  const StockTab({super.key});
  @override
  ConsumerState<StockTab> createState() => _StockTabState();
}

class _StockTabState extends ConsumerState<StockTab> {
  bool lowOnly = false;
  String q = '';
  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    final items = ref.watch(itemsProvider).value ?? const [];
    final low = items.where(isLow).toList();
    final value = items.fold<double>(0, (a, i) => a + i.stock * i.buyPrice);
    final list = (lowOnly ? low : items).where((i) => q.isEmpty || i.name.toLowerCase().contains(q) || i.barcode == q).toList();
    return ListView(padding: const EdgeInsets.only(bottom: 90), children: [
      Header(children: [
        Row(children: [
          Expanded(child: Text(t('stock'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
          IconButton(key: const Key('purchase'), tooltip: t('add_purchase'), onPressed: () => context.push('/purchase'), icon: const Icon(Icons.local_shipping_rounded)),
          IconButton(key: const Key('addItem'), tooltip: t('add_item'), onPressed: () => context.push('/item/new'), icon: const Icon(Icons.add_box_rounded)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          for (final (k, v) in [(t('items'), '${items.length}'), (t('stock_value'), rsShort(value)), (t('low'), '${low.length}')])
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: const TextStyle(fontSize: 12, color: Colors.white70)),
              Text(v, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            ])),
        ]),
      ]),
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
        child: Wrap(children: [
          Pill(t('all'), on: !lowOnly, onTap: () => setState(() => lowOnly = false)),
          Pill('⚠️ ${t('low')}', on: lowOnly, onTap: () => setState(() => lowOnly = true)),
          Pill('📷 ${t('barcode_scan')}', onTap: () async {
            final code = await context.push<String>('/scan');
            if (code == null || !context.mounted) return;
            final it = await ref.read(repoProvider).itemByBarcode(code);
            if (!context.mounted) return;
            context.push(it == null ? '/item/new?barcode=$code' : '/item/${it.id}');
          }),
        ]),
      ),
      AppCard(child: Column(children: [
        TextField(onChanged: (v) => setState(() => q = v.toLowerCase()), decoration: InputDecoration(hintText: '🔍 ${t('search_name')}')),
        if (list.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(t('empty'), style: kMuted)),
        for (final (n, i) in list.indexed)
          Li(
            last: n == list.length - 1,
            onTap: () => context.push('/item/${i.id}'),
            left: Row(children: [
              Avatar(i.name),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(i.name, style: const TextStyle(fontSize: 13)),
                Text('${t('buy')} ${i.buyPrice.round()} • ${t('sell')} ${i.sellPrice.round()}', style: kMuted),
              ])),
            ]),
            right: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(qtyStr(i.stock), style: kBold),
              Tag(isLow(i) ? t('low') : t('ok'), good: !isLow(i)),
            ]),
          ),
      ])),
    ]);
  }
}

class ItemForm extends ConsumerStatefulWidget {
  const ItemForm({super.key, this.id, this.barcode});
  final String? id, barcode;
  @override
  ConsumerState<ItemForm> createState() => _ItemFormState();
}

class _ItemFormState extends ConsumerState<ItemForm> {
  final c = {for (final k in ['name', 'barcode', 'category', 'unit', 'buy', 'sell', 'stock', 'low']) k: TextEditingController()};
  bool loaded = false;

  @override
  void initState() {
    super.initState();
    c['barcode']!.text = widget.barcode ?? '';
    c['unit']!.text = 'pcs';
  }

  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    final items = ref.watch(itemsProvider).value ?? const [];
    if (!loaded && widget.id != null) {
      final it = items.where((i) => i.id == widget.id).firstOrNull;
      if (it != null) {
        loaded = true;
        c['name']!.text = it.name;
        c['barcode']!.text = it.barcode ?? '';
        c['category']!.text = it.category ?? '';
        c['unit']!.text = it.unit;
        c['buy']!.text = qtyStr(it.buyPrice);
        c['sell']!.text = qtyStr(it.sellPrice);
        c['stock']!.text = qtyStr(it.stock);
        c['low']!.text = qtyStr(it.lowStockAt);
      }
    }
    Widget f(String k, String label, {bool num = false, Widget? suffix}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextField(key: Key('f_$k'), controller: c[k], keyboardType: num ? const TextInputType.numberWithOptions(decimal: true) : null,
              decoration: InputDecoration(labelText: label, suffixIcon: suffix)),
        );
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [
          InkWell(onTap: () => context.pop(), child: Text('← ${t('stock')}', style: const TextStyle(fontSize: 12, color: Colors.white70))),
          Text(widget.id == null ? t('add_item') : c['name']!.text, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        ]),
        AppCard(child: Column(children: [
          f('name', t('name')),
          f('barcode', t('barcode'), suffix: IconButton(icon: const Icon(Icons.qr_code_scanner_rounded), onPressed: () async {
            final code = await context.push<String>('/scan');
            if (code != null) c['barcode']!.text = code;
          })),
          Row(children: [Expanded(child: f('category', t('category'))), const SizedBox(width: 8), Expanded(child: f('unit', t('unit')))]),
          Row(children: [Expanded(child: f('buy', t('buy_price'), num: true)), const SizedBox(width: 8), Expanded(child: f('sell', t('sell_price'), num: true))]),
          Row(children: [Expanded(child: f('stock', t('opening_stock'), num: true)), const SizedBox(width: 8), Expanded(child: f('low', t('low_alert'), num: true))]),
        ])),
        GradButton(t('save'), key: const Key('saveItem'), onTap: () async {
          if (c['name']!.text.trim().isEmpty) return;
          final plan = ref.read(planProvider);
          final repo = ref.read(repoProvider);
          if (widget.id == null && plan != null && !plan.canAddItem(await repo.itemCount())) {
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('free_limit'))));
            return;
          }
          double n(String k) => double.tryParse(c[k]!.text) ?? 0;
          await repo.saveItem(id: widget.id, name: c['name']!.text.trim(), barcode: c['barcode']!.text.trim(),
              category: c['category']!.text.trim().isEmpty ? null : c['category']!.text.trim(), unit: c['unit']!.text.trim().isEmpty ? 'pcs' : c['unit']!.text.trim(),
              buyPrice: n('buy'), sellPrice: n('sell'), stock: n('stock'), lowStockAt: n('low'));
          if (context.mounted) context.pop();
        }),
      ]),
    );
  }
}

/// Camera barcode scanner. Pops with the scanned code.
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});
  @override
  ConsumerState<ScanScreen> createState() => _ScanState();
}

class _ScanState extends ConsumerState<ScanScreen> {
  bool done = false;
  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    return Scaffold(
      appBar: AppBar(title: Text(t('scan_title'))),
      body: MobileScanner(onDetect: (cap) {
        final v = cap.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
        if (v != null && !done) {
          done = true;
          context.pop(v);
        }
      }),
    );
  }
}
