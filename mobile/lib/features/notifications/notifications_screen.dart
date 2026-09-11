import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Notifications'), actions: [TextButton(onPressed: () {}, child: const Text('Sab parh li'))]),
    body: ListView.separated(padding: const EdgeInsets.all(16), itemCount: _items.length, separatorBuilder: (_, __) => const SizedBox(height: 8), itemBuilder: (_, i) {
      final item = _items[i];
      return Card(color: item.unread ? AppColors.mint : Colors.white, child: ListTile(
        leading: CircleAvatar(backgroundColor: item.color.withValues(alpha: .12), child: Icon(item.icon, color: item.color)),
        title: Text(item.title, style: TextStyle(fontWeight: item.unread ? FontWeight.w800 : FontWeight.w600)),
        subtitle: Text('${item.body}\n${item.time}', style: const TextStyle(fontSize: 11)),
        isThreeLine: true,
        trailing: item.unread ? const CircleAvatar(radius: 4, backgroundColor: AppColors.green) : null,
      ));
    }),
  );
}

class _Notice { const _Notice(this.title,this.body,this.time,this.icon,this.color,{this.unread=false}); final String title,body,time; final IconData icon; final Color color; final bool unread; }
const _items = [
  _Notice('Order Approved', 'Aap ka order #ORD-7841 approve ho gaya.', '5 min ago', Icons.check_circle_outline, Colors.green, unread: true),
  _Notice('Milk Payment', 'Is haftay ki milk payment Wednesday ko available hogi.', '1 hour ago', Icons.water_drop_outlined, Colors.blue, unread: true),
  _Notice('Stock Alert', 'Engro Urea shop stock minimum level par hai.', 'Today', Icons.inventory_2_outlined, Colors.orange),
  _Notice('Machinery Booking', 'Rice harvester booking schedule confirm ho gaya.', 'Yesterday', Icons.agriculture_outlined, AppColors.green),
];
