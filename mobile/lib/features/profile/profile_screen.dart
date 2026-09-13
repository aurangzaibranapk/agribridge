import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/data/mobile_providers.dart';
import '../../core/models/app_role.dart';
import '../../core/theme/app_theme.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, required this.profile});
  final AppProfile profile;

  @override Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('My Profile')),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [
        CircleAvatar(radius: 28, backgroundColor: AppColors.green, foregroundColor: Colors.white, child: Text(profile.name.isEmpty ? 'AR' : profile.name.substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800))),
        const SizedBox(width: 14), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(profile.name, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)), Text(profile.role.label), if (profile.branchId != null) Text('Branch: ${profile.branchId}', style: const TextStyle(fontSize: 11, color: AppColors.muted))])),
      ]))),
      const SizedBox(height: 14),
      const Card(child: Column(children: [
        ListTile(leading: Icon(Icons.language), title: Text('Language'), subtitle: Text('Urdu • Roman Urdu • English'), trailing: Icon(Icons.chevron_right)),
        Divider(height: 1), ListTile(leading: Icon(Icons.shield_outlined), title: Text('Privacy & Security'), subtitle: Text('RLS-protected account and data')),
      ])),
      const SizedBox(height: 14),
      OutlinedButton.icon(onPressed: () async {
        await ref.read(sessionProvider.notifier).signOut();
      }, icon: const Icon(Icons.logout), label: const Text('Logout')),
      const SizedBox(height: 8),
      TextButton.icon(onPressed: !AppConfig.hasSupabase ? null : () => _requestDeletion(context, ref), icon: const Icon(Icons.delete_outline, color: Colors.red), label: const Text('Account deletion request', style: TextStyle(color: Colors.red))),
    ]),
  );

  Future<void> _requestDeletion(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(
      title: const Text('Account deletion request'),
      content: TextField(controller: controller, maxLines: 3, decoration: const InputDecoration(labelText: 'Reason (optional)')),
      actions: [TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Request'))],
    ));
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(mobileRepositoryProvider).requestAccountDeletion(controller.text.trim());
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request receive ho gayi.')));
    } catch (_) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request submit nahi hui. Dobara koshish karein.')));
    } finally {
      controller.dispose();
    }
  }
}
