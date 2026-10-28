import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';
import '../core/money.dart';
import '../core/t.dart';
import '../core/theme.dart';
import 'khata.dart';
import 'reports.dart';
import 'stock.dart';

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, this.tab = 0});
  final int tab;
  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  late int tab = widget.tab;
  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    Widget nav(int i, IconData ic, String label) => Expanded(
          child: InkWell(
            key: Key('nav$i'),
            onTap: () => setState(() => tab = i),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(ic, color: tab == i ? C.indigo : const Color(0xFF8A90AA), size: 22),
              Text(label, style: TextStyle(fontSize: 10, color: tab == i ? C.indigo : const Color(0xFF8A90AA))),
            ]),
          ),
        );
    return Scaffold(
      body: IndexedStack(index: tab, children: const [DashboardTab(), KhataTab(), StockTab(), ReportsTab()]),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: Container(
        width: 60, height: 60,
        decoration: const BoxDecoration(gradient: C.hot, shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: Color(0x73F97316), blurRadius: 18, offset: Offset(0, 6))]),
        child: Material(
          color: Colors.transparent, shape: const CircleBorder(),
          child: InkWell(key: const Key('fab'), customBorder: const CircleBorder(), onTap: () => context.push('/sale'),
              child: const Icon(Icons.add, color: Colors.white, size: 32)),
        ),
      ),
      bottomNavigationBar: Container(
        height: 70 + MediaQuery.paddingOf(context).bottom,
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x0D000000), blurRadius: 14, offset: Offset(0, -4))]),
        child: Row(children: [
          nav(0, Icons.home_rounded, t('home')),
          nav(1, Icons.menu_book_rounded, t('khata')),
          const SizedBox(width: 70),
          nav(2, Icons.inventory_2_rounded, t('stock')),
          nav(3, Icons.bar_chart_rounded, t('reports')),
        ]),
      ),
    );
  }
}

class Sparkline extends StatelessWidget {
  const Sparkline(this.values, {super.key});
  final List<double> values;
  @override
  Widget build(BuildContext context) => SizedBox(height: 46, width: double.infinity, child: CustomPaint(painter: _Spark(values)));
}

class _Spark extends CustomPainter {
  _Spark(this.v);
  final List<double> v;
  @override
  void paint(Canvas c, Size s) {
    if (v.length < 2) return;
    final mx = v.reduce((a, b) => a > b ? a : b);
    final p = Path();
    for (var i = 0; i < v.length; i++) {
      final x = s.width * i / (v.length - 1);
      final y = s.height - 6 - (mx == 0 ? 0 : v[i] / mx) * (s.height - 12);
      i == 0 ? p.moveTo(x, y) : p.lineTo(x, y);
    }
    c.drawPath(p, Paint()..color = const Color(0xFF6366F1)..style = PaintingStyle.stroke..strokeWidth = 3..strokeJoin = StrokeJoin.round);
  }
  @override
  bool shouldRepaint(_Spark o) => o.v != v;
}

class DashboardTab extends ConsumerWidget {
  const DashboardTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = useT(ref);
    final shop = ref.watch(shopProvider).value;
    final d = ref.watch(dashboardProvider).value;
    final low = ref.watch(lowStockProvider).value ?? const [];
    final plan = ref.watch(planProvider);
    final change = d == null || d.yesterday.sales == 0 ? null : (d.today.sales - d.yesterday.sales) / d.yesterday.sales * 100;
    return ListView(padding: const EdgeInsets.only(bottom: 90), children: [
      Header(children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('greeting'), style: const TextStyle(fontSize: 12, color: Colors.white70)),
            Text(shop?.name ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          ])),
          if (plan?.inTrial == true) Padding(padding: const EdgeInsetsDirectional.only(end: 6), child: Text('${plan!.trialDaysLeft} ${t('trial_left')}', style: const TextStyle(fontSize: 10, color: Colors.white70))),
          IconButton(key: const Key('settings'), onPressed: () => context.push('/settings'), icon: const Icon(Icons.settings_rounded)),
        ]),
        const SizedBox(height: 10),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('today_sale'), style: const TextStyle(fontSize: 12, color: Colors.white70)),
            Text(rs(d?.today.sales ?? 0), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
          ])),
          if (change != null) Tag('${change >= 0 ? '▲' : '▼'} ${change.abs().toStringAsFixed(0)}% ${t('vs_yesterday')}', good: change >= 0),
        ]),
      ]),
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
        child: GridView.count(
          crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.0,
          children: [
            Tile(label: t('profit_today'), value: rs(d?.today.grossProfit ?? 0), gradient: C.t1),
            GestureDetector(onTap: () => context.push('/expenses'), child: Tile(label: t('expense'), value: rs(d?.today.expenses ?? 0), gradient: C.t2)),
            Tile(label: t('receivable'), value: rs(d?.receivable ?? 0), gradient: C.t3),
            Tile(label: t('payable'), value: rs(d?.payable ?? 0), gradient: C.t4),
          ],
        ),
      ),
      AppCard(child: Column(children: [
        Row(children: [Expanded(child: Text(t('money_where'), style: kBold)), Text(t('cash_flow'), style: kMuted)]),
        Li(left: Text('💵 ${t('cash')}'), right: Text(rs(d?.accounts['cash'] ?? 0), style: kBold)),
        Li(left: Text('🏦 ${t('bank')}'), right: Text(rs(d?.accounts['bank'] ?? 0), style: kBold)),
        Li(left: Text('📱 ${t('wallet')}'), right: Text(rs(d?.accounts['wallet'] ?? 0), style: kBold), last: true),
        Sparkline(d?.week ?? const []),
      ])),
      AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('⚠️ ${t('low_stock')}', style: kBold),
        if (low.isEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(t('empty'), style: kMuted)),
        for (final (i, it) in low.take(5).indexed)
          Li(left: Text(it.name), right: Tag('${qtyStr(it.stock)} ${t('left')}'), last: i == low.length - 1 || i == 4,
              onTap: () => context.push('/item/${it.id}')),
      ])),
    ]);
  }
}
