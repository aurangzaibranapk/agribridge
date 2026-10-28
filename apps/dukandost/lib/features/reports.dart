import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../app/providers.dart';
import '../core/money.dart';
import '../core/plan.dart';
import '../core/t.dart';
import '../core/theme.dart';
import '../data/repo.dart';

class ReportData {
  ReportData(this.summary, this.daily, this.top);
  final Summary summary;
  final List<double> daily;
  final List<(String, double, double)> top;
}

final reportProvider = FutureProvider.family<ReportData, String>((ref, period) async {
  ref.watch(dbTickProvider);
  final r = ref.watch(repoProvider);
  final p = Period.of(period);
  final chart = period == 'today' || period == 'year' ? Period.of('week') : p;
  return ReportData(await r.summary(p), await r.dailySales(chart), await r.topItems(p));
});

class Bars extends StatelessWidget {
  const Bars(this.v, {super.key});
  final List<double> v;
  @override
  Widget build(BuildContext context) {
    final mx = v.isEmpty ? 0.0 : v.reduce((a, b) => a > b ? a : b);
    return SizedBox(
      height: 90,
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        for (final (i, x) in v.indexed)
          Expanded(child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            height: mx == 0 ? 4 : 4 + 80 * x / mx,
            decoration: BoxDecoration(
              gradient: i == v.length - 1 ? C.hot : const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)], begin: Alignment.bottomCenter, end: Alignment.topCenter),
              borderRadius: BorderRadius.circular(6)),
          )),
      ]),
    );
  }
}

class ReportsTab extends ConsumerStatefulWidget {
  const ReportsTab({super.key});
  @override
  ConsumerState<ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends ConsumerState<ReportsTab> {
  String period = 'month';
  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    final d = ref.watch(reportProvider(period)).value;
    final plan = ref.watch(planProvider);
    final locked = plan != null && !plan.allows(Feature.reports);
    final mx = (d?.top.isEmpty ?? true) ? 1.0 : d!.top.first.$3;
    void open(String kind) => locked
        ? ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('pro_only'))))
        : context.push('/report/$kind?period=$period');
    return ListView(padding: const EdgeInsets.only(bottom: 90), children: [
      Header(children: [
        Text(t('reports'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        Wrap(children: [
          for (final p in ['today', 'week', 'month', 'year'])
            Pill(t(p), on: period == p, onTap: () => setState(() => period = p)),
        ]),
      ]),
      AppCard(child: Column(children: [
        Row(children: [
          for (final (k, v, c) in [
            (t('sale'), rsShort(d?.summary.sales ?? 0), C.ink),
            (t('profit'), rsShort(d?.summary.netProfit ?? 0), C.green),
            (t('margin'), '${(d?.summary.margin ?? 0).toStringAsFixed(1)}%', C.ink),
          ])
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: kMuted),
              Text(v, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: c)),
            ])),
        ]),
        const SizedBox(height: 14),
        Bars(d?.daily ?? const []),
      ])),
      AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('🔥 ${t('top_items')}', style: kBold),
        if (d?.top.isEmpty ?? true) Padding(padding: const EdgeInsets.only(top: 8), child: Text(t('empty'), style: kMuted)),
        for (final (n, _, a) in d?.top ?? const <(String, double, double)>[])
          Padding(padding: const EdgeInsets.only(top: 8), child: Column(children: [
            Row(children: [Expanded(child: Text(n, style: const TextStyle(fontSize: 13))), Text(rs(a), style: kBold)]),
            const SizedBox(height: 4),
            ClipRRect(borderRadius: BorderRadius.circular(5), child: LinearProgressIndicator(value: a / mx, minHeight: 8, backgroundColor: C.line, color: C.indigo)),
          ])),
      ])),
      AppCard(child: GridView.count(
        crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: 4.2,
        children: [
          for (final (k, ic) in [('r_sale', '📄'), ('r_pl', '📈'), ('r_udhaar', '📒'), ('r_stock', '📦')])
            InkWell(key: Key(k), onTap: () => open(k), child: Align(alignment: AlignmentDirectional.centerStart, child: Text('$ic ${t(k)}${locked ? ' 🔒' : ''}', style: const TextStyle(fontSize: 12)))),
          InkWell(onTap: () => context.push('/expenses'), child: Align(alignment: AlignmentDirectional.centerStart, child: Text('💸 ${t('expenses')}', style: const TextStyle(fontSize: 12)))),
        ],
      )),
    ]);
  }
}

/// Detail view for the 4 MVP reports, shareable as text.
final reportRowsProvider = FutureProvider.family<List<(String, String)>, (String, String)>((ref, key) async {
  ref.watch(dbTickProvider);
  final r = ref.watch(repoProvider);
  final p = Period.of(key.$2);
  switch (key.$1) {
    case 'r_sale':
      final s = await r.summary(p);
      return [('Bills', '${s.count}'), ('Sale', rs(s.sales)), ('Avg bill', rs(s.count == 0 ? 0 : s.sales / s.count)),
        for (final (n, q, a) in await r.topItems(p, limit: 20)) ('$n × ${qtyStr(q)}', rs(a))];
    case 'r_pl':
      final s = await r.summary(p);
      return [('Sale', rs(s.sales)), ('Maal ki laagat (COGS)', rs(s.cost)), ('Gross profit', rs(s.grossProfit)),
        ('Kharchay', rs(s.expenses)), ('Net profit', rs(s.netProfit)), ('Margin', '${s.margin.toStringAsFixed(1)}%')];
    case 'r_udhaar':
      final b = (await r.watchBalances('customer').first).where((x) => x.balance > 0).toList();
      String bucket(int d) => d <= 7 ? '0-7' : d <= 30 ? '8-30' : d <= 60 ? '31-60' : '60+';
      final agg = <String, double>{};
      for (final x in b) { agg[bucket(x.ageDays)] = (agg[bucket(x.ageDays)] ?? 0) + x.balance; }
      return [for (final k in ['0-7', '8-30', '31-60', '60+']) ('$k din', rs(agg[k] ?? 0)),
        for (final x in b) ('${x.party.name} (${x.ageDays}d)', rs(x.balance))];
    default:
      final items = await r.watchItems().first;
      return [('Stock value', rs(await r.stockValue())), ('Items', '${items.length}'),
        for (final i in items) ('${i.name}${i.lowStockAt > 0 && i.stock <= i.lowStockAt ? ' ⚠️' : ''}', '${qtyStr(i.stock)} ${i.unit} • ${rs(i.stock * i.buyPrice)}')];
  }
});

class ReportScreen extends ConsumerWidget {
  const ReportScreen({super.key, required this.kind, required this.period});
  final String kind, period;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = useT(ref);
    final rows = ref.watch(reportRowsProvider((kind, period))).value ?? const [];
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [
          InkWell(onTap: () => context.pop(), child: Text('← ${t('reports')}', style: const TextStyle(fontSize: 12, color: Colors.white70))),
          Row(children: [
            Expanded(child: Text(t(kind), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
            IconButton(onPressed: () => SharePlus.instance.share(ShareParams(text: '${t(kind)} (${t(period)})\n${rows.map((r) => '${r.$1}: ${r.$2}').join('\n')}\n— DukanDost')),
                icon: const Icon(Icons.share_rounded)),
          ]),
          Text(t(period), style: const TextStyle(fontSize: 12, color: Colors.white70)),
        ]),
        AppCard(child: Column(children: [
          for (final (i, r) in rows.indexed) Li(last: i == rows.length - 1, left: Text(r.$1, style: const TextStyle(fontSize: 13)), right: Text(r.$2, style: kBold)),
        ])),
        const SizedBox(height: 24),
      ]),
    );
  }
}
