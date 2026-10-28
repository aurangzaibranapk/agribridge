import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';
import '../core/money.dart';
import '../core/t.dart';
import '../core/theme.dart';
import '../data/db.dart';
import '../data/repo.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});
  @override
  ConsumerState<PosScreen> createState() => _PosState();
}

class _PosState extends ConsumerState<PosScreen> {
  final cart = <CartLine>[];
  String q = '', cat = '';
  String method = 'cash';
  double discount = 0;
  Party? customer;
  final search = TextEditingController();

  void add(Item i) => setState(() {
        final ex = cart.where((l) => l.item.id == i.id).firstOrNull;
        ex == null ? cart.add(CartLine(i)) : ex.qty++;
      });

  Future<void> _scan() async {
    final code = await context.push<String>('/scan');
    if (code != null) await _byCode(code);
  }

  Future<void> _byCode(String code) async {
    final it = await ref.read(repoProvider).itemByBarcode(code);
    if (!mounted) return;
    if (it == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(useT(ref)('not_found'))));
    } else {
      add(it);
      search.clear();
      setState(() => q = '');
    }
  }

  Future<void> _pickCustomer() async {
    final t = useT(ref);
    final list = ref.read(balancesProvider('customer')).value ?? const [];
    final p = await showModalBottomSheet<Object>(
      context: context,
      builder: (c) => ListView(children: [
        ListTile(title: Text(t('walk_in')), onTap: () => Navigator.pop(c, 'walkin')),
        ListTile(leading: const Icon(Icons.person_add_alt_1), title: Text(t('add_party')), onTap: () => Navigator.pop(c, 'new')),
        for (final b in list) ListTile(leading: Avatar(b.party.name), title: Text(b.party.name), trailing: Text(rs(b.balance)), onTap: () => Navigator.pop(c, b.party)),
      ]),
    );
    if (p == 'walkin') setState(() => customer = null);
    if (p is Party) setState(() => customer = p);
    if (p == 'new' && mounted) {
      await showPartyFormInline();
    }
  }

  Future<void> showPartyFormInline() async {
    final t = useT(ref);
    final name = TextEditingController(), phone = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, decoration: InputDecoration(labelText: t('name'))),
        const SizedBox(height: 8),
        TextField(controller: phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('phone'))),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c, true), child: Text(t('save')))],
    ));
    if (ok == true && name.text.trim().isNotEmpty) {
      final repo = ref.read(repoProvider);
      final id = await repo.saveParty(kind: 'customer', name: name.text.trim(), phone: phone.text.trim());
      final p = await repo.party(id);
      setState(() => customer = p);
    }
  }

  Future<void> _discount() async {
    final c = TextEditingController(text: discount == 0 ? '' : qtyStr(discount));
    final v = await showDialog<double>(context: context, builder: (ctx) => AlertDialog(
      content: TextField(controller: c, autofocus: true, keyboardType: TextInputType.number, decoration: const InputDecoration(prefixText: 'Rs ')),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, double.tryParse(c.text) ?? 0), child: const Text('OK'))],
    ));
    if (v != null) setState(() => discount = v);
  }

  Future<void> _checkout() async {
    final t = useT(ref);
    if (cart.isEmpty) return;
    if (method == 'udhaar' && customer == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('udhaar_needs_customer'))));
      return;
    }
    final sale = await ref.read(repoProvider).createSale(lines: cart, method: method, discount: discount, partyId: customer?.id);
    if (mounted) context.pushReplacement('/bill/${sale.id}');
  }

  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    final shop = ref.watch(shopProvider).value;
    final items = ref.watch(itemsProvider).value ?? const [];
    final cats = items.map((i) => i.category).whereType<String>().toSet().toList()..sort();
    final results = (q.isEmpty && cat.isEmpty) ? <Item>[] :
        items.where((i) => (cat.isEmpty || i.category == cat) && (q.isEmpty || i.name.toLowerCase().contains(q))).take(30).toList();
    final subtotal = cart.fold<double>(0, (a, l) => a + l.amount);
    final total = (subtotal - discount).clamp(0, double.infinity);
    return Scaffold(
      body: Column(children: [
        Expanded(child: ListView(padding: EdgeInsets.zero, children: [
          Header(children: [
            Row(children: [
              InkWell(onTap: () => context.pop(), child: const Padding(padding: EdgeInsetsDirectional.only(end: 6), child: Icon(Icons.arrow_back_rounded, size: 20))),
              Expanded(child: Text(t('new_sale'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
              Text('${t('bill')} #S-${shop?.nextBillNo ?? 1}', style: const TextStyle(fontSize: 16)),
            ]),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                Expanded(child: TextField(
                  key: const Key('posSearch'), controller: search,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  onChanged: (v) => setState(() => q = v.toLowerCase()),
                  onSubmitted: _byCode, // Bluetooth scanners type the code + Enter
                  decoration: InputDecoration(hintText: '🔍 ${t('search_items')}', hintStyle: const TextStyle(color: Colors.white70, fontSize: 13), fillColor: Colors.transparent),
                )),
                TextButton.icon(onPressed: _scan, icon: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 18),
                    label: Text(t('barcode_scan'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13))),
              ]),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
              Pill(t('all'), on: cat.isEmpty && q.isEmpty && results.isEmpty, onTap: () => setState(() { cat = cat.isEmpty ? '_' : ''; })),
              for (final c in cats) Pill(c, on: cat == c, onTap: () => setState(() => cat = cat == c ? '' : c)),
            ])),
          ),
          if (cat == '_' || results.isNotEmpty)
            AppCard(child: Column(children: [
              for (final i in cat == '_' ? items : results)
                Li(left: Text(i.name, style: const TextStyle(fontSize: 13)), right: Row(children: [
                  Text(rs(i.sellPrice), style: kMuted),
                  IconButton(key: Key('add_${i.name}'), icon: const Icon(Icons.add_circle_rounded, color: C.indigo), onPressed: () => add(i)),
                ])),
            ])),
          AppCard(child: Column(children: [
            if (cart.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('${t('search_items')} ${t('barcode_scan')}', style: kMuted)),
            for (final (n, l) in cart.indexed)
              Li(
                last: n == cart.length - 1,
                left: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [Avatar(l.item.name), const SizedBox(width: 10), Expanded(child: Text(l.item.name, style: const TextStyle(fontSize: 14)))]),
                  Row(children: [
                    Text('${rs(l.item.sellPrice)} × ${qtyStr(l.qty)}', style: kMuted),
                    IconButton(visualDensity: VisualDensity.compact, iconSize: 18, onPressed: () => setState(() { l.qty--; if (l.qty <= 0) cart.remove(l); }), icon: const Icon(Icons.remove_circle_outline)),
                    IconButton(visualDensity: VisualDensity.compact, iconSize: 18, onPressed: () => setState(() => l.qty++), icon: const Icon(Icons.add_circle_outline)),
                  ]),
                ]),
                right: Text(rs(l.amount), style: kBold),
              ),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Li(onTap: _pickCustomer, left: Text(t('customer')), right: Text('${customer?.name ?? t('walk_in')} ▾', key: const Key('customer'), style: kBold)),
            Li(onTap: _discount, left: Text(t('discount')), right: Text('- ${rs(discount)}', style: kBold)),
            const SizedBox(height: 10),
            Wrap(children: [
              for (final (m, e) in [('cash', '💵'), ('jazzcash', '📱'), ('easypaisa', '📲'), ('bank', '🏦'), ('udhaar', '📒')])
                Pill('$e ${t('m_$m')}', on: method == m, onTap: () => setState(() => method = m)),
            ]),
          ])),
          const SizedBox(height: 12),
        ])),
        Container(
          margin: EdgeInsets.fromLTRB(14, 0, 14, 14 + MediaQuery.paddingOf(context).bottom),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: C.ink, borderRadius: BorderRadius.circular(18)),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${t('total_items')} (${cart.length} items)', style: const TextStyle(color: Colors.white70, fontSize: 11)),
              Text(rs(total), key: const Key('posTotal'), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
            ])),
            SizedBox(width: 160, child: GradButton('${t('make_bill')} →', key: const Key('checkout'), gradient: C.hot, margin: EdgeInsets.zero, onTap: cart.isEmpty ? null : _checkout)),
          ]),
        ),
      ]),
    );
  }
}
