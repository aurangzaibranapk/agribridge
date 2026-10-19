import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/models/app_role.dart';
import '../notifications/notifications_screen.dart';
import '../office/service_inbox_screen.dart';
import '../office/staff_work_screen.dart';
import '../profile/profile_screen.dart';
import 'farmer_screens.dart' show push;
import 'role_data.dart';
import 'role_prefs.dart';
import 'role_ui.dart';

/// Sales staff: Home, Parties, + Entry, Kaam, Profile. Branch qaida server (605) par.
class StaffShell extends StatefulWidget {
  const StaffShell({super.key, required this.profile});
  final AppProfile profile;
  @override
  State<StaffShell> createState() => _StaffShellState();
}

class _StaffShellState extends State<StaffShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      StaffHome(profile: widget.profile, onOpenParties: () => setState(() => index = 1)),
      const PartyListScreen(),
      StaffTasksScreen(profile: widget.profile),
      ProfileScreen(profile: widget.profile),
    ];
    return RoleScaffold(
      index: index,
      onTap: (i) => setState(() => index = i),
      onPlus: () => showStaffEntrySheet(context),
      plusLabel: context.tr(T.newEntry),
      items: [
        NavEntry(Icons.home_rounded, context.tr(T.home)),
        NavEntry(Icons.groups_rounded, context.tr(T.parties), key: const ValueKey('nav-parties')),
        NavEntry(Icons.task_alt_rounded, context.tr(T.tasks)),
        NavEntry(Icons.person_rounded, context.tr(T.profile)),
      ],
      body: pages[index],
    );
  }
}

class StaffHome extends ConsumerWidget {
  const StaffHome({super.key, required this.profile, this.onOpenParties});
  final AppProfile profile;
  final VoidCallback? onOpenParties;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(staffSummaryProvider);
    final d = s.valueOrNull ?? const {};
    final parties = ref.watch(partyListProvider).valueOrNull ?? const [];
    Widget stat(String label, String value, String sub, Color c) => Expanded(child: RCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 11, color: context.muted)),
          FittedBox(child: Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: c))),
          Text(sub, style: TextStyle(fontSize: 10.5, color: context.muted)),
        ])));
    return RefreshIndicator(
      onRefresh: () async { ref.invalidate(staffSummaryProvider); ref.invalidate(partyListProvider); },
      child: ListView(padding: EdgeInsets.zero, children: [
        RoleTopBar(staff: true, subtitle: 'Sales · ${profile.rawRole ?? ''}', onBell: () => push(context, const NotificationsScreen())),
        Padding(padding: const EdgeInsets.fromLTRB(14, 10, 14, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('${context.tr(T.salam)} ${profile.name}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: context.ink))),
            if (AppConfig.demoMode) const SampleTag(),
          ]),
          if (s.hasError) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Summary load nahi hui (605 live nahi?)', style: const TextStyle(color: RC.red, fontSize: 11))),
          const SizedBox(height: 8),
          Row(children: [
            stat(context.tr(T.salesToday), rs(d['sales_today'] as num?), '${d['bills_today'] ?? 0} bills', context.accent),
            const SizedBox(width: 8),
            stat(context.tr(T.recoveryToday), rs(d['recovery_today'] as num?), 'Receipts', RC.ok),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            stat(context.tr(T.branchDue), rs(d['branch_due'] as num?), '${d['parties_due'] ?? 0} parties', RC.red),
            const SizedBox(width: 8),
            stat(context.tr(T.promisesToday), num0(d['promises_today'] as num?), rs(d['promises_today_amount'] as num?), const Color(0xFFE08A00)),
          ]),
          const SizedBox(height: 9),
          RCard(key: const ValueKey('staff-search'), onTap: onOpenParties, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11), child: Row(children: [
            Icon(Icons.search, color: context.muted), const SizedBox(width: 8),
            Expanded(child: Text(context.tr(T.search), style: TextStyle(color: context.muted, fontSize: 12.5), overflow: TextOverflow.ellipsis)),
          ])),
          SectionHead(context.tr(T.pendingWork)),
          TileGrid(columns: 4, compact: true, tiles: [
            TileData(Icons.shopping_bag_rounded, const Color(0xFF00838F), context.tr(T.orders), badge: d['pending_orders'] as int?, onTap: () => push(context, StaffTasksScreen(profile: profile))),
            TileData(Icons.inventory_2_rounded, const Color(0xFFE08A00), 'Demands', badge: d['pending_demands'] as int?, onTap: () => push(context, StaffTasksScreen(profile: profile))),
            TileData(Icons.event_note_rounded, const Color(0xFFF9A825), 'Season', badge: d['pending_bookings'] as int?, onTap: () => push(context, StaffTasksScreen(profile: profile))),
            TileData(Icons.pending_actions_rounded, const Color(0xFF5E35B1), 'Entries', badge: d['pending_entries'] as int?, onTap: () => push(context, StaffTasksScreen(profile: profile))),
          ]),
          SectionHead(context.tr(T.recoveryList), action: context.tr(T.viewAll), onAction: onOpenParties),
          RCard(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), child: Column(children: [
            for (final p in parties.where((p) => ((p['due'] as num?) ?? 0) > 0).take(3)) PartyRow(p),
          ])),
          const SizedBox(height: 90),
        ])),
      ]),
    );
  }
}

class PartyRow extends StatelessWidget {
  const PartyRow(this.p, {super.key});
  final Map<String, dynamic> p;
  @override
  Widget build(BuildContext context) {
    final age = p['age_days'] as int?;
    final promise = p['next_promise']?.toString();
    return TxRow(
      key: ValueKey('party-${p['id']}'),
      icon: p['kind'] == 'farmer' ? Icons.agriculture_rounded : Icons.storefront_rounded,
      iconColor: (age ?? 0) >= 60 ? RC.red : (age ?? 0) >= 30 ? const Color(0xFFE08A00) : RC.green,
      title: '${p['name']}',
      sub: [p['code'], p['phone_masked'], if (age != null) '$age din'].where((e) => e != null && '$e'.isNotEmpty).join(' · '),
      amount: rs(p['due'] as num?),
      positive: ((p['due'] as num?) ?? 0) <= 0,
      trail: promise == null ? null : 'Wada: $promise',
      onTap: () => push(context, PartyViewScreen(partyId: '${p['id']}')),
    );
  }
}

class PartyListScreen extends ConsumerStatefulWidget {
  const PartyListScreen({super.key});
  @override
  ConsumerState<PartyListScreen> createState() => _PartyListState();
}

class _PartyListState extends ConsumerState<PartyListScreen> {
  final q = TextEditingController();
  @override
  void dispose() { q.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final f = ref.watch(partyQueryProvider);
    final list = ref.watch(partyListProvider);
    void set({String? kind, int? minAge, bool clearAge = false}) => ref.read(partyQueryProvider.notifier).state = (q: q.text.trim(), kind: kind ?? f.kind, minAge: clearAge ? null : (minAge ?? f.minAge));
    Widget chip(String label, bool on, VoidCallback tap, {Color? c}) => Padding(padding: const EdgeInsetsDirectional.only(end: 6), child: ChoiceChip(label: Text(label, style: const TextStyle(fontSize: 11)), selected: on, onSelected: (_) => tap(), selectedColor: c ?? RC.green, labelStyle: TextStyle(color: on ? Colors.white : null)));
    return ListView(padding: EdgeInsets.zero, children: [
      const RoleTopBar(staff: true, subtitle: 'Parties · Recovery'),
      Padding(padding: const EdgeInsets.fromLTRB(14, 10, 14, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          key: const ValueKey('party-search'),
          controller: q,
          onSubmitted: (_) => set(),
          decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: context.tr(T.search), filled: true, fillColor: context.cardBg, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none)),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
          chip('Sab', f.kind == 'all', () => set(kind: 'all')),
          chip('Farmers', f.kind == 'farmer', () => set(kind: 'farmer')),
          chip('Customers', f.kind == 'customer', () => set(kind: 'customer')),
          chip('60+ din', f.minAge == 60, () => f.minAge == 60 ? set(clearAge: true) : set(minAge: 60), c: RC.red),
        ])),
        const SizedBox(height: 8),
        RCard(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), child: list.when(
          loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: Text('List load nahi hui: $e')),
          data: (rows) => Column(children: [for (final p in rows) PartyRow(p), if (rows.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Koi party nahi'))]),
        )),
        const SizedBox(height: 6),
        Center(child: Text(context.tr(T.waConfirm), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: context.muted))),
        const SizedBox(height: 90),
      ])),
    ]);
  }
}

class PartyViewScreen extends ConsumerWidget {
  const PartyViewScreen({super.key, required this.partyId});
  final String partyId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(partyViewProvider(partyId));
    return Scaffold(body: v.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Party nahi khuli: $e')),
      data: (p) {
        final khata = List<Map<String, dynamic>>.from((p['khata'] as List?) ?? const []);
        final promises = List<Map<String, dynamic>>.from((p['promises'] as List?) ?? const []);
        final actions = <TileData>[
          TileData(Icons.payments_rounded, RC.ok, 'Recovery', onTap: () => showStaffEntrySheet(context, party: p, kind: 'recovery')),
          TileData(Icons.receipt_rounded, const Color(0xFF3949AB), 'Sale', onTap: () => showStaffEntrySheet(context, party: p, kind: 'cash_sale')),
          TileData(Icons.local_drink_rounded, const Color(0xFF1E88E5), 'Milk', onTap: () => showStaffEntrySheet(context, party: p, kind: 'milk')),
          TileData(Icons.handshake_rounded, const Color(0xFF8E24AA), 'Wada', onTap: () => showStaffEntrySheet(context, party: p, kind: 'promise')),
          TileData(Icons.call_rounded, const Color(0xFF00897B), 'Call', onTap: () => _call(context, p['phone']?.toString())),
          TileData(Icons.chat_rounded, const Color(0xFF25D366), 'WhatsApp*', key: const ValueKey('party-wa'), onTap: () => confirmWhatsApp(context, p)),
          TileData(Icons.place_rounded, RC.red, 'Visit', onTap: () => showStaffEntrySheet(context, party: p, kind: 'visit_note')),
          TileData(Icons.inventory_2_rounded, const Color(0xFFE08A00), 'Demand', onTap: () => showStaffEntrySheet(context, party: p, kind: 'demand')),
        ];
        return ListView(padding: EdgeInsets.zero, children: [
          const RoleTopBar(staff: true, back: true, subtitle: 'Party view'),
          Padding(padding: const EdgeInsets.fromLTRB(14, 10, 14, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            RCard(child: Row(children: [
              CircleAvatar(radius: 24, backgroundColor: const Color(0xFFF6C87A), child: Icon(p['kind'] == 'farmer' ? Icons.agriculture_rounded : Icons.storefront_rounded, color: RC.green)),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Flexible(child: Text('${p['name']}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: context.ink))), if (AppConfig.demoMode) const Padding(padding: EdgeInsetsDirectional.only(start: 6), child: SampleTag())]),
                Text('${p['code']} · ${maskPhone(p['phone']?.toString())}', style: TextStyle(fontSize: 11, color: context.muted)),
                const SizedBox(height: 3),
                Wrap(spacing: 4, children: [_pill(p['kind'] == 'farmer' ? 'Farmer' : 'Customer', const Color(0xFFE8F5E3), RC.green)]),
              ])),
            ])),
            const SizedBox(height: 8),
            KpiStrip(items: [
              Kpi(Icons.account_balance_wallet, RC.red, num0(p['due'] as num?), 'Baqaya', valueColor: RC.red),
              Kpi(Icons.schedule, const Color(0xFFE08A00), p['age_days'] == null ? '—' : '${p['age_days']} din', 'Purana'),
              Kpi(Icons.credit_score, RC.green, num0(p['credit_limit'] as num?), 'Limit'),
            ]),
            const SizedBox(height: 8),
            TileGrid(columns: 4, compact: true, tiles: actions),
            SectionHead('Khata'),
            RCard(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), child: Column(children: [
              for (final k in khata)
                TxRow(
                  icon: ((k['credit'] as num?) ?? 0) > 0 ? Icons.payments_rounded : Icons.receipt_long_rounded,
                  title: '${k['ref']}', sub: '${k['source']}',
                  amount: ((k['credit'] as num?) ?? 0) > 0 ? '+ ${rs(k['credit'] as num)}' : '- ${rs(k['debit'] as num?)}',
                  positive: ((k['credit'] as num?) ?? 0) > 0, trail: '${k['date']}',
                ),
              if (khata.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Koi entry nahi')),
            ])),
            if (promises.isNotEmpty) ...[
              SectionHead('Wade'),
              for (final w in promises) RCard(child: Text('${rs(w['amount'] as num?)} — ${w['date']}', style: TextStyle(color: context.ink, fontWeight: FontWeight.w700))),
            ],
            const SizedBox(height: 6),
            Text('* ${context.tr(T.waConfirm)} · ${context.tr(T.pendingNote)}', style: TextStyle(fontSize: 9.5, color: context.muted)),
            const SizedBox(height: 24),
          ])),
        ]);
      },
    ));
  }

  static Widget _pill(String t, Color bg, Color fg) => Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(9)), child: Text(t, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: fg)));

  static Future<void> _call(BuildContext context, String? phone) async {
    if (phone == null || phone.isEmpty) { snack(context, 'Number nahi'); return; }
    await launchUrl(Uri(scheme: 'tel', path: phone));
  }
}


/// WhatsApp: pehle preview + confirm. Confirm ke baad sirf WhatsApp khulta hai; bhejna staff khud dabata hai.
Future<void> confirmWhatsApp(BuildContext context, Map<String, dynamic> p) async {
  final text = 'Assalam-o-Alaikum ${p['name']}, Al Rana Traders se. Aap ka baqaya ${rs(p['due'] as num?)} hai. Shukriya.';
  final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
        key: const ValueKey('wa-confirm'),
        title: const Text('WhatsApp message'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(text),
          const SizedBox(height: 10),
          Text(ctx.tr(T.waConfirm), style: const TextStyle(fontSize: 11, color: RC.muted)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(key: const ValueKey('wa-confirm-yes'), onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm · WhatsApp kholein')),
        ],
      ));
  if (ok != true || !context.mounted) return;
  final phone = p['phone']?.toString();
  if (phone == null || phone.isEmpty || AppConfig.demoMode) { snack(context, AppConfig.demoMode ? 'Demo: WhatsApp nahi khola gaya' : 'Number nahi'); return; }
  await launchUrl(whatsappUri(phone, text), mode: LaunchMode.externalApplication);
}

String newClientUuid() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((e) => e.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

Future<void> showStaffEntrySheet(BuildContext context, {Map<String, dynamic>? party, String kind = 'recovery'}) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => StaffEntrySheet(party: party, kind: kind),
    );

class StaffEntrySheet extends ConsumerStatefulWidget {
  const StaffEntrySheet({super.key, this.party, this.kind = 'recovery'});
  final Map<String, dynamic>? party;
  final String kind;
  @override
  ConsumerState<StaffEntrySheet> createState() => _EntryState();
}

class _EntryState extends ConsumerState<StaffEntrySheet> {
  late String kind = widget.kind;
  Map<String, dynamic>? party;
  String method = 'cash';
  final amount = TextEditingController();
  final note = TextEditingController();
  final clientUuid = newClientUuid(); // ek sheet = ek entry; dobara Save par dobara entry nahi
  bool busy = false;
  static const kinds = [
    ('recovery', 'Recovery', Icons.payments_rounded, RC.ok),
    ('milk', 'Milk', Icons.local_drink_rounded, Color(0xFF1E88E5)),
    ('cash_sale', 'Sale (cash)', Icons.receipt_rounded, Color(0xFF3949AB)),
    ('promise', 'Wada', Icons.handshake_rounded, Color(0xFF8E24AA)),
    ('demand', 'Demand', Icons.inventory_2_rounded, Color(0xFFE08A00)),
    ('visit_note', 'Visit note', Icons.edit_note_rounded, Color(0xFF6D4C41)),
  ];

  @override
  void initState() { super.initState(); party = widget.party; }
  @override
  void dispose() { amount.dispose(); note.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final parties = ref.watch(partyListProvider).valueOrNull ?? const [];
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.tr(T.newEntry), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: context.ink)),
        const SizedBox(height: 10),
        TileGrid(compact: true, tiles: [
          for (final k in kinds) TileData(k.$3, k.$4, k.$2, key: ValueKey('kind-${k.$1}'), badge: kind == k.$1 ? 1 : null, onTap: () => setState(() => kind = k.$1)),
        ]),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          key: const ValueKey('entry-party'),
          initialValue: party?['id']?.toString(),
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Party', border: OutlineInputBorder()),
          items: [
            if (party != null && !parties.any((p) => p['id'] == party!['id'])) DropdownMenuItem(value: '${party!['id']}', child: Text('${party!['name']}')),
            for (final p in parties) DropdownMenuItem(value: '${p['id']}', child: Text('${p['name']} · ${p['code']}  (${rs(p['due'] as num?)})', overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (id) => setState(() => party = parties.firstWhere((p) => p['id'] == id, orElse: () => party ?? const {})),
        ),
        if (StaffEntryDraft.needsAmount.contains(kind)) ...[
          const SizedBox(height: 9),
          TextField(key: const ValueKey('entry-amount'), controller: amount, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: kind == 'milk' ? 'Litre' : 'Raqam (Rs)', border: const OutlineInputBorder())),
        ],
        if (kind == 'recovery' || kind == 'cash_sale') ...[
          const SizedBox(height: 9),
          Wrap(spacing: 6, children: [for (final m in const ['cash', 'bank', 'jazzcash', 'easypaisa']) ChoiceChip(label: Text(m), selected: method == m, onSelected: (_) => setState(() => method = m))]),
        ],
        const SizedBox(height: 9),
        TextField(controller: note, maxLength: 1000, maxLines: 2, decoration: const InputDecoration(labelText: 'Note', border: OutlineInputBorder())),
        RCard(color: context.isNavy ? RC.navyLine : const Color(0xFFFFF8E6), child: Text(context.tr(T.pendingNote), style: TextStyle(fontSize: 11, color: context.ink))),
        const SizedBox(height: 10),
        SizedBox(width: double.infinity, child: FilledButton(key: const ValueKey('entry-save'), onPressed: busy ? null : _save, style: FilledButton.styleFrom(backgroundColor: RC.green, padding: const EdgeInsets.all(14)), child: Text(context.tr(T.save)))),
      ])),
    );
  }

  Future<void> _save() async {
    final draft = StaffEntryDraft(
      clientUuid: clientUuid, kind: kind, partyId: party?['id']?.toString() ?? '',
      amount: StaffEntryDraft.needsAmount.contains(kind) ? double.tryParse(amount.text.trim()) : null,
      method: (kind == 'recovery' || kind == 'cash_sale') ? method : null,
      note: note.text.trim().isEmpty ? null : note.text.trim(),
    );
    final err = draft.validate();
    if (err != null) { snack(context, err); return; }
    setState(() => busy = true);
    try {
      if (AppConfig.demoMode) {
        final n = ref.read(demoEntriesProvider.notifier);
        if (!n.state.any((e) => e['id'] == clientUuid)) {
          n.state = [{'id': clientUuid, 'kind': kind, 'party': party?['name'], 'amount': draft.amount, 'status': 'pending', 'created_at': DateTime.now().toIso8601String()}, ...n.state];
        }
      } else {
        await ref.read(roleRepositoryProvider).submitEntry(draft);
        ref.invalidate(myEntriesProvider);
        ref.invalidate(staffSummaryProvider);
      }
      if (mounted) { Navigator.pop(context); snack(context, 'Entry PENDING mein chali gayi'); }
    } catch (e) {
      if (mounted) snack(context, 'Entry save nahi hui: $e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}

class StaffTasksScreen extends ConsumerWidget {
  const StaffTasksScreen({super.key, required this.profile});
  final AppProfile profile;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = ref.watch(myEntriesProvider).valueOrNull ?? const [];
    final body = ListView(padding: EdgeInsets.zero, children: [
      RoleTopBar(staff: true, back: Navigator.canPop(context), subtitle: context.tr(T.tasks)),
      Padding(padding: const EdgeInsets.fromLTRB(14, 10, 14, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionHead('Meri app entries'),
        RCard(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), child: Column(children: [
          for (final e in entries)
            TxRow(
              icon: Icons.pending_actions_rounded,
              iconColor: e['status'] == 'approved' ? RC.ok : e['status'] == 'rejected' ? RC.red : const Color(0xFFE08A00),
              title: '${e['party'] ?? ''} · ${e['kind']}', sub: '${e['created_at']}'.split('T').first,
              amount: e['amount'] == null ? '' : rs(e['amount'] as num), positive: true, trail: '${e['status']}'.toUpperCase(),
            ),
          if (entries.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Koi entry nahi')),
        ])),
        const SizedBox(height: 10),
        if (!AppConfig.demoMode)
          OutlinedButton.icon(onPressed: () => push(context, profile.role == AppRole.admin ? ServiceInboxScreen(profile: profile) : StaffWorkScreen(profile: profile)), icon: const Icon(Icons.work_outline), label: const Text('Office ka kaam')),
        const SizedBox(height: 90),
      ])),
    ]);
    return Navigator.canPop(context) ? Scaffold(body: body) : body;
  }
}
