import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show NumberFormat;

import '../../core/auth/session_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/models/app_role.dart';
import 'role_prefs.dart';

/// Approved mockup ke rang (19 Oct 2026).
abstract final class RC {
  static const cream = Color(0xFFFBF8F0);
  static const green = Color(0xFF0F5A2E);
  static const greenLight = Color(0xFF1D7A44);
  static const gold = Color(0xFFF5B323);
  static const ink = Color(0xFF1D2B1F);
  static const muted = Color(0xFF6B7468);
  static const red = Color(0xFFD32F2F);
  static const ok = Color(0xFF1B8A3A);
  static const navyBg = Color(0xFF0B1630);
  static const navyCard = Color(0xFF13224A);
  static const navyLine = Color(0xFF1D2F5E);
  static const navyBar = Color(0xFF08102A);
}

ThemeData buildCreamTheme() => ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(seedColor: RC.green, primary: RC.green, secondary: RC.gold, surface: Colors.white),
      scaffoldBackgroundColor: RC.cream,
      fontFamily: 'Roboto',
      cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero, color: Colors.white),
    );

ThemeData buildNavyTheme() => ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(seedColor: RC.green, brightness: Brightness.dark, primary: RC.gold, secondary: RC.gold, surface: RC.navyCard),
      scaffoldBackgroundColor: RC.navyBg,
      fontFamily: 'Roboto',
      cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero, color: RC.navyCard),
    );

extension PaletteX on BuildContext {
  Color get cardBg => isNavy ? RC.navyCard : Colors.white;
  Color get ink => isNavy ? const Color(0xFFE6ECF7) : RC.ink;
  Color get muted => isNavy ? const Color(0xFF9FB0D0) : RC.muted;
  Color get accent => isNavy ? RC.gold : RC.green;
  Color get barBg => isNavy ? RC.navyBar : RC.green;
  Color get softLine => isNavy ? RC.navyLine : const Color(0xFFF0ECE2);
}

final _rs = NumberFormat('#,##0', 'en_US');
String rs(num? v) => v == null ? '—' : 'Rs ${_rs.format(v)}';
String num0(num? v) => v == null ? '—' : _rs.format(v);

/// Saaf safaid / navy card.
class RCard extends StatelessWidget {
  const RCard({super.key, required this.child, this.padding = const EdgeInsets.all(12), this.color, this.gradient, this.onTap});
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final Gradient? gradient;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            padding: padding,
            decoration: BoxDecoration(
              color: gradient == null ? (color ?? context.cardBg) : null,
              gradient: gradient,
              borderRadius: BorderRadius.circular(16),
              boxShadow: context.isNavy ? null : const [BoxShadow(color: Color(0x14204020), blurRadius: 8, offset: Offset(0, 2))],
            ),
            child: child,
          ),
        ),
      );
}

/// EN / Roman / اردو chips.
class LangToggle extends ConsumerWidget {
  const LangToggle({super.key, this.onDark = false});
  final bool onDark;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(appLangProvider);
    Widget chip(AppLang l, String label) => GestureDetector(
          key: ValueKey('lang-${l.name}'),
          onTap: () => ref.read(appLangProvider.notifier).state = l,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(color: lang == l ? (onDark ? RC.gold : RC.green) : Colors.transparent, borderRadius: BorderRadius.circular(10)),
            child: Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: lang == l ? (onDark ? RC.green : Colors.white) : (onDark ? Colors.white70 : context.muted))),
          ),
        );
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(color: onDark ? Colors.white12 : (context.isNavy ? RC.navyLine : const Color(0xFFE9EFE6)), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [chip(AppLang.en, 'EN'), chip(AppLang.roman, 'Roman'), chip(AppLang.ur, 'اردو')]),
      ),
    );
  }
}

/// Upar wali patti: AgriBridge logo, zabaan, ghanti, avatar. Staff ke liye hari patti.
class RoleTopBar extends ConsumerWidget {
  const RoleTopBar({super.key, this.back = false, this.staff = false, this.subtitle, this.onBell, this.trailing});
  final bool back;
  final bool staff;
  final String? subtitle;
  final VoidCallback? onBell;
  final Widget? trailing;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fg = staff ? Colors.white : context.accent;
    final content = Row(children: [
      if (back) IconButton(onPressed: () => Navigator.maybePop(context), icon: Icon(Icons.arrow_back, color: staff ? Colors.white : context.ink)),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(staff ? context.tr(T.staffApp) : 'AgriBridge', style: TextStyle(color: fg, fontSize: 21, fontWeight: FontWeight.w800)),
        Text(subtitle ?? context.tr(T.tagline), style: TextStyle(fontSize: 10.5, color: staff ? const Color(0xFFCFE5D4) : context.muted)),
      ])),
      if (trailing != null) trailing!,
      if (AppConfig.demoMode)
        PopupMenuButton<AppRole>(
          key: const ValueKey('demo-role-switch'),
          tooltip: 'Demo role',
          icon: Icon(Icons.swap_horiz_rounded, color: staff ? Colors.white : context.ink, size: 20),
          onSelected: (r) => ref.read(sessionProvider.notifier).useDemoRole(r),
          itemBuilder: (_) => const [
            PopupMenuItem(value: AppRole.farmer, child: Text('Demo: Farmer')),
            PopupMenuItem(value: AppRole.customer, child: Text('Demo: Customer')),
            PopupMenuItem(value: AppRole.staff, child: Text('Demo: Sales staff')),
          ],
        ),
      LangToggle(onDark: staff),
      IconButton(
        key: const ValueKey('bell'),
        onPressed: onBell,
        icon: Badge(smallSize: 8, backgroundColor: RC.red, child: Icon(Icons.notifications_none_rounded, color: staff ? Colors.white : context.ink)),
      ),
      CircleAvatar(radius: 17, backgroundColor: const Color(0xFFF6C87A), child: Icon(staff ? Icons.badge_outlined : Icons.person, color: RC.green, size: 20)),
    ]);
    if (!staff) return SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.fromLTRB(14, 6, 10, 6), child: content));
    return Container(
      decoration: BoxDecoration(color: context.barBg, borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18))),
      child: SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.fromLTRB(14, 8, 10, 10), child: content)),
    );
  }
}

/// Hero banner (kheet ka manzar + kisan).
class HeroBanner extends StatelessWidget {
  const HeroBanner({super.key, required this.title, required this.name, required this.code, this.icon = Icons.agriculture_rounded, this.warm = false});
  final String title;
  final String name;
  final String code;
  final IconData icon;
  final bool warm;
  @override
  Widget build(BuildContext context) {
    final navy = context.isNavy;
    final sky = warm ? const [Color(0xFFF7D9A0), Color(0xFFE9A957)] : navy ? const [Color(0xFF1B2D63), Color(0xFF2A4A3A)] : const [Color(0xFF9FD3F0), Color(0xFFCFE9C8)];
    return Container(
      height: 150,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: sky)),
      child: Stack(children: [
        if (!warm) Positioned(left: 0, right: 0, bottom: 0, height: 62, child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: navy ? const [Color(0xFF7A6326), Color(0xFF574515)] : const [Color(0xFFE2C062), Color(0xFFB8902F)])))),
        PositionedDirectional(end: 8, bottom: 0, child: Icon(icon, size: 110, color: navy ? RC.gold.withValues(alpha: .85) : RC.green.withValues(alpha: .85))),
        PositionedDirectional(start: 0, top: 0, bottom: 0, width: 230, child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [navy ? RC.navyCard : const Color(0xFFFFFDF5), (navy ? RC.navyCard : const Color(0xFFFFFDF5)).withValues(alpha: 0)])))),
        Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: context.ink)),
          Text(context.tr(T.salam), style: TextStyle(fontSize: 12.5, color: context.ink)),
          Text(name, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: context.accent)),
          const SizedBox(height: 3),
          Text(code, style: TextStyle(fontSize: 10.5, color: context.muted)),
        ])),
        if (AppConfig.demoMode) const PositionedDirectional(top: 8, end: 10, child: SampleTag()),
      ]),
    );
  }
}

class SampleTag extends StatelessWidget {
  const SampleTag({super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: const Color(0xFFFFF3CD), borderRadius: BorderRadius.circular(8)),
        child: const Text('SAMPLE DATA', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF8A6D00))),
      );
}

class Kpi {
  const Kpi(this.icon, this.color, this.value, this.label, {this.valueColor});
  final IconData icon;
  final Color color;
  final String value;
  final String label;
  final Color? valueColor;
}

class KpiStrip extends StatelessWidget {
  const KpiStrip({super.key, required this.items});
  final List<Kpi> items;
  @override
  Widget build(BuildContext context) => Row(children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 7),
          Expanded(child: RCard(padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2), child: Column(children: [
            Icon(items[i].icon, color: items[i].color, size: 22),
            FittedBox(child: Text(items[i].value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: items[i].valueColor ?? context.accent))),
            Text(items[i].label, style: TextStyle(fontSize: 9.5, color: context.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
          ]))),
        ],
      ]);
}

class TileData {
  const TileData(this.icon, this.color, this.label, {this.sub, this.onTap, this.badge, this.key});
  final IconData icon;
  final Color color;
  final String label;
  final String? sub;
  final VoidCallback? onTap;
  final int? badge;
  final Key? key;
}

/// Rangeen icon tiles ka grid.
class TileGrid extends StatelessWidget {
  const TileGrid({super.key, required this.tiles, this.columns = 3, this.compact = false});
  final List<TileData> tiles;
  final int columns;
  final bool compact;
  @override
  Widget build(BuildContext context) => GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: columns,
        mainAxisSpacing: 9,
        crossAxisSpacing: 9,
        childAspectRatio: compact ? .95 : 1.08,
        padding: EdgeInsets.zero,
        children: [for (final t in tiles) _Tile(t, compact: compact)],
      );
}

class _Tile extends StatelessWidget {
  const _Tile(this.t, {required this.compact});
  final TileData t;
  final bool compact;
  @override
  Widget build(BuildContext context) => RCard(
        key: t.key,
        onTap: t.onTap,
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        child: Stack(children: [
          Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              width: compact ? 34 : 42, height: compact ? 34 : 42,
              decoration: BoxDecoration(color: t.color.withValues(alpha: .14), borderRadius: BorderRadius.circular(12)),
              child: Icon(t.icon, color: t.color, size: compact ? 20 : 24),
            ),
            const SizedBox(height: 5),
            Text(t.label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: compact ? 10 : 11.5, fontWeight: FontWeight.w700, color: context.ink)),
            if (t.sub != null && !compact) Text(t.sub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 9, color: context.muted)),
          ])),
          if ((t.badge ?? 0) > 0)
            PositionedDirectional(top: 0, end: 0, child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(color: RC.red, borderRadius: BorderRadius.circular(9)),
              child: Text('${t.badge}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
            )),
        ]),
      );
}

class SectionHead extends StatelessWidget {
  const SectionHead(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 12, 2, 6),
        child: Row(children: [
          Expanded(child: Text(title, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: context.ink))),
          if (action != null) GestureDetector(onTap: onAction, child: Text(action!, style: TextStyle(color: context.accent, fontSize: 11.5, fontWeight: FontWeight.w700))),
        ]),
      );
}

class TxRow extends StatelessWidget {
  const TxRow({super.key, required this.icon, required this.title, required this.sub, required this.amount, this.positive = false, this.trail, this.onTap, this.iconColor});
  final IconData icon;
  final String title;
  final String sub;
  final String amount;
  final bool positive;
  final String? trail;
  final VoidCallback? onTap;
  final Color? iconColor;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: context.softLine))),
          child: Row(children: [
            Container(width: 34, height: 34, decoration: BoxDecoration(color: (iconColor ?? RC.green).withValues(alpha: .12), borderRadius: BorderRadius.circular(10)), child: Icon(icon, size: 18, color: iconColor ?? (context.isNavy ? RC.gold : RC.green))),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: context.ink)),
              Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10, color: context.muted)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(amount, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: positive ? RC.ok : RC.red)),
              if (trail != null) Text(trail!, style: TextStyle(fontSize: 10, color: context.muted)),
            ]),
          ]),
        ),
      );
}

class NavEntry {
  const NavEntry(this.icon, this.label, {this.key});
  final IconData icon;
  final String label;
  final Key? key;
}

/// Hari bottom patti, beech mein peela "+".
class RoleScaffold extends StatelessWidget {
  const RoleScaffold({super.key, required this.body, required this.items, required this.index, required this.onTap, required this.onPlus, this.plusLabel = 'Add'});
  final Widget body;
  final List<NavEntry> items; // 4 items: 2 left, 2 right
  final int index;
  final ValueChanged<int> onTap;
  final VoidCallback onPlus;
  final String plusLabel;
  @override
  Widget build(BuildContext context) {
    Widget item(int i) => Expanded(child: InkWell(
          key: items[i].key ?? ValueKey('nav-$i'),
          onTap: () => onTap(i),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(items[i].icon, color: i == index ? Colors.white : const Color(0xFFB9D7C2), size: 22),
            Text(items[i].label, style: TextStyle(fontSize: 10.5, color: i == index ? Colors.white : const Color(0xFFB9D7C2), fontWeight: i == index ? FontWeight.w800 : FontWeight.w500)),
          ]),
        ));
    return Scaffold(
      body: body,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: SizedBox(width: 62, height: 62, child: FloatingActionButton(
        key: const ValueKey('plus'),
        tooltip: plusLabel,
        onPressed: onPlus,
        shape: CircleBorder(side: BorderSide(color: Theme.of(context).scaffoldBackgroundColor, width: 4)),
        backgroundColor: RC.gold,
        foregroundColor: RC.green,
        child: const Icon(Icons.add_rounded, size: 32),
      )),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(color: context.barBg, borderRadius: const BorderRadius.vertical(top: Radius.circular(18))),
        child: SafeArea(top: false, child: SizedBox(height: 62, child: Row(children: [item(0), item(1), const SizedBox(width: 70), item(2), item(3)]))),
      ),
    );
  }
}

class PageTitle extends StatelessWidget {
  const PageTitle({super.key, required this.icon, required this.color, required this.title, this.sub});
  final IconData icon;
  final Color color;
  final String title;
  final String? sub;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 0, 2, 10),
        child: Row(children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: color.withValues(alpha: .14), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: color, size: 26)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: context.ink)),
            if (sub != null) Text(sub!, style: TextStyle(fontSize: 11, color: context.muted)),
          ])),
        ]),
      );
}

void snack(BuildContext context, String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
