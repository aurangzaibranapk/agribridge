import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, required this.name, required this.subtitle, this.badge});
  final String name;
  final String subtitle;
  final String? badge;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 22),
        decoration: const BoxDecoration(
          color: AppColors.navy,
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const CircleAvatar(backgroundColor: AppColors.green, child: Icon(Icons.eco, color: Colors.white)),
            const SizedBox(width: 10),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Al Rana Traders', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
              Text('A g r i B r i d g e', style: TextStyle(color: Color(0xFF9DD3B0), fontSize: 10)),
            ])),
            IconButton(onPressed: () {}, icon: const Badge(label: Text('3'), child: Icon(Icons.notifications_outlined, color: Colors.white))),
          ]),
          const SizedBox(height: 18),
          Row(children: [
            Expanded(child: Text('Assalam-o-Alaikum, $name', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800))),
            if (badge != null) Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: AppColors.gold, borderRadius: BorderRadius.circular(20)), child: Text(badge!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
          ]),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: Color(0xFFB8CBD4), fontSize: 12)),
        ]),
      );
}

class MetricCard extends StatelessWidget {
  const MetricCard({super.key, required this.label, required this.value, required this.icon, this.tint = AppColors.green, this.caption});
  final String label;
  final String value;
  final IconData icon;
  final Color tint;
  final String? caption;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: tint),
            const Spacer(),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            const SizedBox(height: 3),
            Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.ink)),
            if (caption != null) Text(caption!, maxLines: 1, style: TextStyle(fontSize: 9, color: tint)),
          ]),
        ),
      );
}

class QuickAction extends StatelessWidget {
  const QuickAction({super.key, required this.label, required this.icon, this.onTap});
  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.line), borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Container(width: 38, height: 38, decoration: BoxDecoration(color: AppColors.mint, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: AppColors.green, size: 21)),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.muted),
          ]),
        ),
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action = 'View All'});
  final String title;
  final String action;

  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink))),
        Text(action, style: const TextStyle(fontSize: 11, color: AppColors.green, fontWeight: FontWeight.w700)),
      ]);
}

class StatusRow extends StatelessWidget {
  const StatusRow({super.key, required this.title, required this.subtitle, required this.status, this.color = AppColors.green, this.icon = Icons.receipt_long_outlined});
  final String title;
  final String subtitle;
  final String status;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withValues(alpha: .1), borderRadius: BorderRadius.circular(11)), child: Icon(icon, color: color, size: 19)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)), Text(subtitle, style: const TextStyle(fontSize: 10, color: AppColors.muted))])),
          Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: color.withValues(alpha: .1), borderRadius: BorderRadius.circular(20)), child: Text(status, style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.w700))),
        ]),
      );
}
