import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/data/mobile_providers.dart';
import '../../core/models/app_role.dart';
import '../../core/theme/app_theme.dart';
import '../commerce/order_history_screen.dart';
import '../notifications/notifications_screen.dart';

/// Staff only: displays records returned for the signed-in profile.
class StaffWorkScreen extends ConsumerWidget {
  const StaffWorkScreen({super.key, required this.profile});
  final AppProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (profile.role != AppRole.staff) {
      return const Scaffold(body: Center(child: Text('Staff access zaroori hai.')));
    }
    final orders = ref.watch(ordersProvider);
    final alerts = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Work')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(ordersProvider);
          ref.invalidate(notificationsProvider);
          await Future.wait([
            ref.read(ordersProvider.future),
            ref.read(notificationsProvider.future),
          ]);
        },
        child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(16), children: [
          Text('Assalam-o-Alaikum, ${profile.name}', style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Aap ke apne orders aur alerts. Branch ka baqi kaam ERP permission ke mutabiq milega.', style: TextStyle(color: AppColors.muted)),
          const SizedBox(height: 18),
          _section(context, 'Mere Orders', Icons.receipt_long_outlined,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OrderHistoryScreen()))),
          const SizedBox(height: 8),
          orders.when(
            loading: () => const Card(child: ListTile(title: Text('Orders load ho rahe hain…'))),
            error: (_, __) => Card(child: ListTile(title: const Text('Orders load nahi huay.'), trailing: TextButton(onPressed: () => ref.invalidate(ordersProvider), child: const Text('Retry')))),
            data: (rows) => rows.isEmpty
              ? const Card(child: ListTile(title: Text('Abhi aap ke naam par koi order nahi.')))
              : Column(children: rows.take(5).map((row) => Card(child: ListTile(
                  leading: const CircleAvatar(backgroundColor: AppColors.mint, child: Icon(Icons.shopping_bag_outlined, color: AppColors.green)),
                  title: Text(row['order_number']?.toString() ?? 'Order', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(row['status']?.toString().replaceAll('_', ' ') ?? 'Submitted'),
                  trailing: Text('Rs ${NumberFormat('#,##0').format((row['grand_total'] as num?) ?? 0)}'),
                ))).toList()),
          ),
          const SizedBox(height: 18),
          _section(context, 'Mere Alerts', Icons.notifications_outlined,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()))),
          const SizedBox(height: 8),
          alerts.when(
            loading: () => const Card(child: ListTile(title: Text('Alerts load ho rahe hain…'))),
            error: (_, __) => Card(child: ListTile(title: const Text('Alerts load nahi huay.'), trailing: TextButton(onPressed: () => ref.invalidate(notificationsProvider), child: const Text('Retry')))),
            data: (rows) => rows.isEmpty
              ? const Card(child: ListTile(title: Text('Abhi koi alert nahi.')))
              : Column(children: rows.take(5).map((row) => Card(child: ListTile(
                  leading: const Icon(Icons.notifications_outlined, color: AppColors.green),
                  title: Text(row['title']?.toString() ?? 'Notification'),
                  subtitle: Text(row['message']?.toString() ?? '', maxLines: 2, overflow: TextOverflow.ellipsis),
                ))).toList()),
          ),
          const SizedBox(height: 80),
        ]),
      ),
    );
  }

  Widget _section(BuildContext context, String label, IconData icon, {required VoidCallback onTap}) =>
      Row(children: [
        Icon(icon, color: AppColors.green),
        const SizedBox(width: 8),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
        TextButton(onPressed: onTap, child: const Text('View all')),
      ]);
}
