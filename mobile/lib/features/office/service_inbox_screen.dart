import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/config/app_config.dart';
import '../../core/data/mobile_providers.dart';
import '../../core/models/app_role.dart';
import '../../core/theme/app_theme.dart';

/// The inbox reads and updates only rows allowed by mobile_service_requests RLS.
/// A request is an enquiry; it does not create an ERP booking or financial entry.
class ServiceInboxScreen extends ConsumerStatefulWidget {
  const ServiceInboxScreen({super.key, required this.profile});
  final AppProfile profile;

  @override
  ConsumerState<ServiceInboxScreen> createState() => _ServiceInboxScreenState();
}

class _ServiceInboxScreenState extends ConsumerState<ServiceInboxScreen> {
  String filter = 'open';
  bool saving = false;

  @override
  Widget build(BuildContext context) {
    if (widget.profile.role != AppRole.admin) {
      return const Scaffold(body: Center(child: Text('Is inbox ke liye admin access zaroori hai.')));
    }
    final state = ref.watch(officeServiceRequestsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Service Requests')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Farmer requests', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            const Text('Machinery, grain, veterinary aur crop doctor requests. Request ko review karein; ERP booking aur payment alag confirm karein.', style: TextStyle(color: AppColors.muted)),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'open', label: Text('Open')),
                ButtonSegment(value: 'all', label: Text('All')),
              ],
              selected: {filter},
              onSelectionChanged: (value) => setState(() => filter = value.first),
            ),
          ]),
        ),
        Expanded(child: state.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(child: TextButton.icon(
            onPressed: () => ref.invalidate(officeServiceRequestsProvider),
            icon: const Icon(Icons.refresh),
            label: const Text('Requests dobara load karein'),
          )),
          data: (rows) {
            final visible = filter == 'all' ? rows : rows.where((row) =>
              !const ['completed', 'rejected', 'cancelled'].contains(row['status'])).toList();
            if (visible.isEmpty) return const Center(child: Text('Is filter mein koi request nahi.'));
            return RefreshIndicator(
              onRefresh: () => ref.refresh(officeServiceRequestsProvider.future).then((_) {}),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                itemCount: visible.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) => _requestCard(visible[index]),
              ),
            );
          },
        )),
      ]),
    );
  }

  Widget _requestCard(Map<String, dynamic> row) {
    final type = (row['request_type']?.toString() ?? 'service').replaceAll('_', ' ');
    final status = row['status']?.toString() ?? 'submitted';
    final date = DateTime.tryParse(row['created_at']?.toString() ?? '');
    final details = row['details'] is Map ? Map<String, dynamic>.from(row['details'] as Map) : <String, dynamic>{};
    final profile = row['profiles'];
    final farmer = profile is Map ? profile['full_name']?.toString() ?? profile['name']?.toString() : null;
    return Card(child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.agriculture_outlined, color: AppColors.green),
          const SizedBox(width: 8),
          Expanded(child: Text(_title(type), style: const TextStyle(fontWeight: FontWeight.w800))),
          Chip(label: Text(_title(status.replaceAll('_', ' ')))),
        ]),
        if (farmer != null && farmer.isNotEmpty) Text(farmer, style: const TextStyle(fontWeight: FontWeight.w600)),
        if (date != null) Text(DateFormat('dd MMM yyyy, h:mm a').format(date.toLocal()), style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        const Divider(),
        ...details.entries.map((entry) => Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text('${entry.key}: ${entry.value}', maxLines: 2, overflow: TextOverflow.ellipsis),
        )),
        const SizedBox(height: 8),
        Align(alignment: Alignment.centerRight, child: OutlinedButton(
          onPressed: saving || AppConfig.demoMode ? null : () => _changeStatus(row),
          child: const Text('Status update'),
        )),
        if (AppConfig.demoMode) const Text('Demo preview: changes save nahi hotin.', style: TextStyle(fontSize: 11, color: AppColors.muted)),
      ]),
    ));
  }

  Future<void> _changeStatus(Map<String, dynamic> row) async {
    final current = row['status']?.toString() ?? 'submitted';
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(child: ListView(
        shrinkWrap: true,
        children: [
          const ListTile(title: Text('Request ka status'), subtitle: Text('Booking/payment sirf ERP workflow mein confirm karein.')),
          for (final status in const ['submitted', 'in_review', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled'])
            ListTile(
              title: Text(_title(status.replaceAll('_', ' '))),
              selected: status == current,
              onTap: () => Navigator.pop(sheetContext, status),
            ),
        ],
      )),
    );
    if (selected == null || selected == current || !mounted) return;
    setState(() => saving = true);
    try {
      await ref.read(mobileRepositoryProvider).updateOfficeServiceRequest(
        id: row['id'].toString(), status: selected,
      );
      ref.invalidate(officeServiceRequestsProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request update ho gayi.')));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Status save nahi hua. Access aur connection check karein.')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  static String _title(String text) => text.split(' ').map((word) =>
    word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}').join(' ');
}
