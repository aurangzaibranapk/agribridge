import 'package:flutter/material.dart';

class C {
  static const indigo = Color(0xFF4F46E5);
  static const teal = Color(0xFF0EA5A4);
  static const coral = Color(0xFFF97316);
  static const rose = Color(0xFFFB7185);
  static const bg = Color(0xFFF4F6FB);
  static const ink = Color(0xFF1B2140);
  static const muted = Color(0xFF6B7393);
  static const line = Color(0xFFEEF0F6);
  static const chip = Color(0xFFEEF2FF);
  static const green = Color(0xFF10B981);
  static const red = Color(0xFFEF4444);
  static const brand = LinearGradient(colors: [indigo, teal], begin: Alignment.topLeft, end: Alignment.bottomRight);
  static const hot = LinearGradient(colors: [coral, rose], begin: Alignment.topLeft, end: Alignment.bottomRight);
  static const t1 = LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)]);
  static const t2 = hot;
  static const t3 = LinearGradient(colors: [Color(0xFF10B981), Color(0xFF14B8A6)]);
  static const t4 = LinearGradient(colors: [Color(0xFF0EA5E9), Color(0xFF3B82F6)]);
}

ThemeData appTheme() => ThemeData(
      useMaterial3: true,
      fontFamilyFallback: const ['Noto Color Emoji', 'Noto Sans Arabic'],
      scaffoldBackgroundColor: C.bg,
      colorScheme: ColorScheme.fromSeed(seedColor: C.indigo, primary: C.indigo, secondary: C.teal),
      textTheme: const TextTheme().apply(bodyColor: C.ink, displayColor: C.ink),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: C.bg,
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        labelStyle: const TextStyle(color: C.muted, fontSize: 13),
      ),
    );

/// Gradient header with rounded bottom used on every main screen.
class Header extends StatelessWidget {
  const Header({super.key, required this.children, this.gradient = C.brand, this.bottom = 18});
  final List<Widget> children;
  final Gradient gradient;
  final double bottom;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        decoration: BoxDecoration(gradient: gradient, borderRadius: const BorderRadius.vertical(bottom: Radius.circular(26))),
        padding: EdgeInsets.fromLTRB(18, MediaQuery.paddingOf(context).top + 18, 18, bottom),
        child: DefaultTextStyle.merge(
          style: const TextStyle(color: Colors.white),
          child: IconTheme.merge(data: const IconThemeData(color: Colors.white), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children)),
        ),
      );
}

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(14), this.margin = const EdgeInsets.fromLTRB(14, 12, 14, 0)});
  final Widget child;
  final EdgeInsets padding, margin;
  @override
  Widget build(BuildContext context) => Container(
        margin: margin,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          boxShadow: const [BoxShadow(color: Color(0x121E285A), blurRadius: 14, offset: Offset(0, 4))],
        ),
        child: Material(color: Colors.white, borderRadius: BorderRadius.circular(18), child: Padding(padding: padding, child: child)),
      );
}

class Tile extends StatelessWidget {
  const Tile({super.key, required this.label, required this.value, required this.gradient});
  final String label, value;
  final Gradient gradient;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11)),
          const SizedBox(height: 4),
          FittedBox(child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700))),
        ]),
      );
}

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.on = false, this.onTap});
  final String label;
  final bool on;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 6, bottom: 6),
        child: Material(
          color: on ? C.indigo : C.chip,
          borderRadius: BorderRadius.circular(20),
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              child: Text(label, style: TextStyle(fontSize: 12, color: on ? Colors.white : C.indigo, fontWeight: on ? FontWeight.w600 : FontWeight.w400)),
            ),
          ),
        ),
      );
}

class Tag extends StatelessWidget {
  const Tag(this.label, {super.key, this.good = false});
  final String label;
  final bool good;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: good ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(10)),
        child: Text(label, style: TextStyle(fontSize: 10, color: good ? const Color(0xFF047857) : const Color(0xFFB91C1C))),
      );
}

class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 34});
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
    final ini = parts.isEmpty ? '?' : parts.take(2).map((p) => p.characters.first.toUpperCase()).join();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: C.chip, shape: BoxShape.circle),
      child: Text(ini, style: TextStyle(color: C.indigo, fontWeight: FontWeight.w700, fontSize: size * .38)),
    );
  }
}

class GradButton extends StatelessWidget {
  const GradButton(this.label, {super.key, this.onTap, this.gradient = C.brand, this.margin = const EdgeInsets.fromLTRB(14, 12, 14, 0)});
  final String label;
  final VoidCallback? onTap;
  final Gradient gradient;
  final EdgeInsets margin;
  @override
  Widget build(BuildContext context) => Padding(
        padding: margin,
        child: Opacity(
          opacity: onTap == null ? .5 : 1,
          child: Container(
            decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(14)),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Center(child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15))),
                ),
              ),
            ),
          ),
        ),
      );
}

/// Row with label at start, value at end and a hairline divider.
class Li extends StatelessWidget {
  const Li({super.key, required this.left, required this.right, this.last = false, this.onTap});
  final Widget left, right;
  final bool last;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: C.line))),
          child: Row(children: [Expanded(child: left), right]),
        ),
      );
}

const kMuted = TextStyle(fontSize: 11, color: C.muted);
const kBold = TextStyle(fontWeight: FontWeight.w700);
