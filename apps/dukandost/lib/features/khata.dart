import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app/providers.dart';
import '../core/money.dart';
import '../core/plan.dart';
import '../core/t.dart';
import '../core/theme.dart';
import '../data/db.dart';
import '../services/whatsapp.dart';

class KhataTab extends ConsumerStatefulWidget {
  const KhataTab({super.key});
  @override
  ConsumerState<KhataTab> createState() => _KhataTabState();
}

class _KhataTabState extends ConsumerState<KhataTab> {
  String kind = 'customer';
  String q = '';
  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    final cust = ref.watch(balancesProvider('customer')).value ?? const [];
    final sup = ref.watch(balancesProvider('supplier')).value ?? const [];
    final list = (kind == 'customer' ? cust : sup)
        .where((b) => q.isEmpty || b.party.name.toLowerCase().contains(q) || (b.party.phone ?? '').contains(q))
        .toList();
    final lena = cust.fold<double>(0, (a, b) => a + b.balance);
    final dena = sup.fold<double>(0, (a, b) => a + b.balance);
    return ListView(padding: const EdgeInsets.only(bottom: 90), children: [
      Header(children: [
        Row(children: [
          Expanded(child: Text(t('khata_title'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
          IconButton(key: const Key('addParty'), onPressed: () => showPartyForm(context, ref, kind), icon: const Icon(Icons.person_add_alt_1_rounded)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('lena_kul'), style: const TextStyle(fontSize: 12, color: Colors.white70)),
            Text(rs(lena), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          ])),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('dena_kul'), style: const TextStyle(fontSize: 12, color: Colors.white70)),
            Text(rs(dena), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          ])),
        ]),
      ]),
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
        child: Wrap(children: [
          Pill('${t('customers')} (${cust.length})', on: kind == 'customer', onTap: () => setState(() => kind = 'customer')),
          Pill('${t('suppliers')} (${sup.length})', on: kind == 'supplier', onTap: () => setState(() => kind = 'supplier')),
        ]),
      ),
      AppCard(child: Column(children: [
        TextField(onChanged: (v) => setState(() => q = v.toLowerCase()),
            decoration: InputDecoration(hintText: '🔍 ${t('search_name')}', fillColor: C.bg)),
        if (list.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(t('empty'), style: kMuted)),
        for (final (i, b) in list.indexed)
          Li(
            last: i == list.length - 1,
            onTap: () => context.push('/party/${b.party.id}'),
            left: Row(children: [
              Avatar(b.party.name),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(b.party.name, style: const TextStyle(fontSize: 13)),
                Text(
                  b.party.promiseDate != null
                      ? '${t('promise')}: ${DateFormat('d MMM').format(b.party.promiseDate!)}'
                      : b.lastAt == null ? (b.party.phone ?? '') : '${b.ageDays} ${t('days_ago')}',
                  style: kMuted,
                ),
              ])),
            ]),
            right: Text(rs(b.balance), style: TextStyle(fontWeight: FontWeight.w700, color: kind == 'customer' ? (b.balance > 0 ? C.red : C.green) : C.coral)),
          ),
      ])),
    ]);
  }
}

Future<void> showPartyForm(BuildContext context, WidgetRef ref, String kind) async {
  final t = useT(ref);
  final name = TextEditingController(), phone = TextEditingController(), limit = TextEditingController();
  final ok = await showModalBottomSheet<bool>(
    context: context, isScrollControlled: true,
    builder: (c) => Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('${t('add_party')} • ${t(kind == 'customer' ? 'customer' : 'supplier')}', style: kBold),
        const SizedBox(height: 10),
        TextField(key: const Key('partyName'), controller: name, decoration: InputDecoration(labelText: t('name'))),
        const SizedBox(height: 8),
        TextField(controller: phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('phone'))),
        const SizedBox(height: 8),
        TextField(controller: limit, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('credit_limit'))),
        GradButton(t('save'), margin: const EdgeInsets.only(top: 12), onTap: () => Navigator.pop(c, true)),
      ]),
    ),
  );
  if (ok == true && name.text.trim().isNotEmpty) {
    await ref.read(repoProvider).saveParty(kind: kind, name: name.text.trim(), phone: phone.text.trim(), creditLimit: double.tryParse(limit.text));
  }
}

class PartyScreen extends ConsumerWidget {
  const PartyScreen({super.key, required this.id});
  final String id;

  Future<void> _entry(BuildContext context, WidgetRef ref, Party p, int sign) async {
    final t = useT(ref);
    final amount = TextEditingController(), note = TextEditingController();
    var method = 'cash';
    final ok = await showModalBottomSheet<bool>(
      context: context, isScrollControlled: true,
      builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(key: const Key('entryAmount'), controller: amount, autofocus: true, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('amount'))),
          const SizedBox(height: 8),
          TextField(controller: note, decoration: InputDecoration(labelText: t('note'))),
          if (sign < 0) ...[
            const SizedBox(height: 8),
            Wrap(children: [for (final m in ['cash', 'jazzcash', 'easypaisa', 'bank']) Pill(t('m_$m'), on: method == m, onTap: () => set(() => method = m))]),
          ],
          GradButton(t('save'), key: const Key('entrySave'), margin: const EdgeInsets.only(top: 12), onTap: () => Navigator.pop(c, true)),
        ]),
      )),
    );
    final v = double.tryParse(amount.text);
    if (ok == true && v != null && v > 0) {
      await ref.read(repoProvider).addLedger(p.id, sign * v, note: note.text.isEmpty ? null : note.text, method: sign < 0 ? method : null);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = useT(ref);
    final parties = ref.watch(balancesProvider('customer')).value ?? const [];
    final sups = ref.watch(balancesProvider('supplier')).value ?? const [];
    final pb = [...parties, ...sups].where((b) => b.party.id == id).firstOrNull;
    final entries = ref.watch(ledgerProvider(id)).value ?? const [];
    final shop = ref.watch(shopProvider).value;
    final plan = ref.watch(planProvider);
    if (pb == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final p = pb.party;
    final isCust = p.kind == 'customer';
    final limit = p.creditLimit;
    Widget action(String label, IconData ic, Color c, VoidCallback onTap, Key key) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Material(
              color: c, borderRadius: BorderRadius.circular(14),
              child: InkWell(key: key, borderRadius: BorderRadius.circular(14), onTap: onTap, child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Column(children: [
                  Icon(ic, color: Colors.white, size: 20),
                  Text(label, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                ]),
              )),
            ),
          ),
        );
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [
          InkWell(onTap: () => context.pop(), child: Text('← ${t('khata')}', style: const TextStyle(fontSize: 12, color: Colors.white70))),
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              Text('${p.phone ?? ''} • ${t(isCust ? 'customer' : 'supplier')}', style: const TextStyle(fontSize: 12, color: Colors.white70)),
            ])),
            Container(width: 46, height: 46, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle), child: Center(child: Avatar(p.name, size: 46))),
          ]),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: DefaultTextStyle.merge(style: const TextStyle(color: C.ink), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t(isCust ? 'receivable' : 'payable'), style: kMuted),
                  Text(rs(pb.balance), key: const Key('partyBalance'), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: isCust ? C.green : C.coral)),
                ])),
                if (limit != null) Text('${t('credit_limit')}: ${rs(limit)}', style: kMuted),
              ]),
              if (limit != null && limit > 0) ...[
                const SizedBox(height: 8),
                ClipRRect(borderRadius: BorderRadius.circular(5), child: LinearProgressIndicator(
                    value: (pb.balance / limit).clamp(0, 1).toDouble(), minHeight: 8, backgroundColor: C.line, color: C.indigo)),
              ],
            ])),
          ),
        ]),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(children: [
            action(t('reminder'), Icons.chat_rounded, const Color(0xFF25D366), () async {
              if (plan != null && !plan.allows(Feature.whatsappReminders)) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('pro_only'))));
                return;
              }
              final msg = t('reminder_msg', {'name': p.name, 'shop': shop?.name ?? 'DukanDost', 'amount': rs(pb.balance)});
              await launchUrl(whatsappUri(p.phone, msg), mode: LaunchMode.externalApplication);
            }, const Key('remind')),
            action(t(isCust ? 'got_paid' : 'paid_supplier'), Icons.south_rounded, C.green, () => _entry(context, ref, p, -1), const Key('gotPaid')),
            action(t(isCust ? 'gave_udhaar' : 'got_goods'), Icons.north_rounded, C.red, () => _entry(context, ref, p, 1), const Key('gaveUdhaar')),
          ]),
        ),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t('transactions'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          if (entries.isEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(t('empty'), style: kMuted)),
          for (final (i, e) in entries.indexed)
            Li(
              last: i == entries.length - 1,
              left: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${DateFormat('dd MMM').format(e.createdAt)} • ${e.note ?? (e.method == null ? '' : t('m_${e.method}'))}', style: const TextStyle(fontSize: 13)),
                Text(e.amount > 0 ? (e.refType == 'sale' ? 'Udhaar sale' : t(isCust ? 'gave_udhaar' : 'got_goods')) : 'Wasooli', style: kMuted),
              ]),
              right: Text('${e.amount > 0 ? '+' : '-'}${rs(e.amount.abs()).substring(3)}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: e.amount > 0 ? C.red : C.green)),
            ),
        ])),
        if (isCust)
          Container(
            margin: const EdgeInsets.fromLTRB(14, 12, 14, 24),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: C.chip, borderRadius: BorderRadius.circular(18)),
            child: InkWell(
              onTap: () async {
                final d = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                if (d != null) await ref.read(repoProvider).setPromise(p.id, d);
              },
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('🗓️ ${t('promise')}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(p.promiseDate == null ? t('set_promise') : '${DateFormat('d MMM').format(p.promiseDate!)} • ${rs(pb.balance)}. ${t('promise_note')}',
                    style: const TextStyle(fontSize: 13)),
              ]),
            ),
          ),
      ]),
    );
  }
}
