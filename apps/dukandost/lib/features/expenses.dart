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

const expenseCategories = ['Tankhwah', 'Kiraya', 'Bijli/Gas', 'Chai/Khana', 'Transport', 'Deegar'];
const _colors = [Color(0xFF6366F1), Color(0xFFF97316), Color(0xFF0EA5A4), Color(0xFF3B82F6), Color(0xFFFB7185), Color(0xFF10B981)];

final monthExpensesProvider = StreamProvider<List<Expense>>((ref) => ref.watch(repoProvider).watchExpenses(Period.of('month')));

class Donut extends CustomPainter {
  Donut(this.parts);
  final List<(double, Color)> parts;
  @override
  void paint(Canvas c, Size s) {
    final total = parts.fold<double>(0, (a, p) => a + p.$1);
    final r = Rect.fromCircle(center: s.center(Offset.zero), radius: s.shortestSide / 2 - 10);
    var a = -math.pi / 2;
    if (total == 0) {
      c.drawArc(r, 0, 2 * math.pi, false, Paint()..color = C.line..style = PaintingStyle.stroke..strokeWidth = 18);
      return;
    }
    for (final p in parts) {
      final sweep = p.$1 / total * 2 * math.pi;
      c.drawArc(r, a, sweep, false, Paint()..color = p.$2..style = PaintingStyle.stroke..strokeWidth = 18);
      a += sweep;
    }
  }
  @override
  bool shouldRepaint(Donut o) => true;
}

class ExpensesScreen extends ConsumerWidget {
  const ExpensesScreen({super.key});

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final t = useT(ref);
    var cat = expenseCategories[1];
    var method = 'cash';
    final amount = TextEditingController(), note = TextEditingController();
    final ok = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(t('add_expense'), style: kBold),
        const SizedBox(height: 8),
        Wrap(children: [for (final e in expenseCategories) Pill(e, on: cat == e, onTap: () => set(() => cat = e))]),
        TextField(key: const Key('expAmount'), controller: amount, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('amount'))),
        const SizedBox(height: 8),
        TextField(controller: note, decoration: InputDecoration(labelText: t('note'))),
        const SizedBox(height: 8),
        Wrap(children: [for (final m in ['cash', 'jazzcash', 'easypaisa', 'bank']) Pill(t('m_$m'), on: method == m, onTap: () => set(() => method = m))]),
        GradButton(t('save'), key: const Key('expSave'), margin: const EdgeInsets.only(top: 12), onTap: () => Navigator.pop(c, true)),
      ]),
    )));
    final v = double.tryParse(amount.text);
    if (ok == true && v != null && v > 0) {
      await ref.read(repoProvider).addExpense(category: cat, amount: v, note: note.text.isEmpty ? null : note.text, method: method);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = useT(ref);
    final list = ref.watch(monthExpensesProvider).value ?? const [];
    final total = list.fold<double>(0, (a, e) => a + e.amount);
    final by = <String, double>{};
    for (final e in list) {
      by[e.category] = (by[e.category] ?? 0) + e.amount;
    }
    final cats = by.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [
          InkWell(onTap: () => context.pop(), child: Text('← ${t('home')}', style: const TextStyle(fontSize: 12, color: Colors.white70))),
          Text(t('expenses'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('this_month'), style: const TextStyle(fontSize: 12, color: Colors.white70)),
              Text(rs(total), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                child: Text(DateFormat('MMM yyyy').format(DateTime.now()), style: const TextStyle(color: C.indigo, fontSize: 12))),
          ]),
        ]),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t('by_type'), style: kBold),
          Row(children: [
            SizedBox(width: 130, height: 130, child: CustomPaint(painter: Donut([for (final (i, e) in cats.indexed) (e.value, _colors[i % _colors.length])]))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (final (i, e) in cats.indexed)
                Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: _colors[i % _colors.length], shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text('${e.key} ${(e.value / total * 100).round()}%', style: const TextStyle(fontSize: 12)),
                ])),
            ])),
          ]),
        ])),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t('recent_exp'), style: kBold),
          if (list.isEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(t('empty'), style: kMuted)),
          for (final (i, e) in list.take(20).indexed)
            Li(last: i == list.length - 1 || i == 19,
                left: Text('${e.category}${e.note == null ? '' : ' • ${e.note}'}', style: const TextStyle(fontSize: 13)),
                right: Text(rs(e.amount), style: kBold)),
        ])),
        GradButton('+ ${t('add_expense')}', key: const Key('addExpense'), onTap: () => _add(context, ref)),
        const SizedBox(height: 24),
      ]),
    );
  }
}
