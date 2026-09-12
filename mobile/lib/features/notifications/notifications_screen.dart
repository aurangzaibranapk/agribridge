import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notificationsProvider);
    final rows = AppConfig.demoMode ? _demoItems : (state.valueOrNull ?? const []);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), actions: [
        TextButton(onPressed: rows.isEmpty ? null : () async {
          final profile = ref.read(sessionProvider).valueOrNull;
          if (profile == null) return;
          await ref.read(mobileRepositoryProvider).markAllNotificationsRead(profile.id);
          ref.invalidate(notificationsProvider);
        }, child: const Text('Sab parh li')),
      ]),
      body: state.isLoading && AppConfig.hasSupabase
          ? const Center(child: CircularProgressIndicator())
          : state.hasError && AppConfig.hasSupabase
              ? Center(child: TextButton.icon(onPressed: () => ref.invalidate(notificationsProvider), icon: const Icon(Icons.refresh), label: const Text('Notifications dobara load karein')))
              : rows.isEmpty
                  ? const Center(child: Text('Abhi koi notification nahi.'))
                  : RefreshIndicator(
                      onRefresh: () => ref.refresh(notificationsProvider.future).then((_) {}),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: rows.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) => _NoticeCard(row: rows[i]),
                      ),
                    ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.row});
  final Map<String, dynamic> row;
  @override Widget build(BuildContext context) {
    final unread = row['is_read'] != true;
    final created = DateTime.tryParse(row['created_at']?.toString() ?? '');
    final time = created == null ? '' : '${created.toLocal().day}/${created.toLocal().month}/${created.toLocal().year}';
    return Card(color: unread ? AppColors.mint : Colors.white, child: ListTile(
      leading: CircleAvatar(backgroundColor: AppColors.green.withValues(alpha: .12), child: const Icon(Icons.notifications_outlined, color: AppColors.green)),
      title: Text(row['title']?.toString() ?? 'Update', style: TextStyle(fontWeight: unread ? FontWeight.w800 : FontWeight.w600)),
      subtitle: Text('${row['message'] ?? ''}${time.isEmpty ? '' : '\n$time'}', style: const TextStyle(fontSize: 11)),
      isThreeLine: time.isNotEmpty,
      trailing: unread ? const CircleAvatar(radius: 4, backgroundColor: AppColors.green) : null,
    ));
  }
}

const _demoItems = <Map<String, dynamic>>[
  {'title': 'Order Approved', 'message': 'Aap ka order #ORD-7841 approve ho gaya.', 'is_read': false},
  {'title': 'Milk Payment', 'message': 'Is haftay ki milk payment Wednesday ko available hogi.', 'is_read': false},
  {'title': 'Machinery Booking', 'message': 'Rice harvester booking schedule confirm ho gaya.', 'is_read': true},
];
