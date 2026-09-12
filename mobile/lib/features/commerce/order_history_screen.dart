import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/config/app_config.dart';
import '../../core/data/mobile_providers.dart';
import '../../core/theme/app_theme.dart';
import 'product_catalog_screen.dart';

class OrderHistoryScreen extends ConsumerWidget {
  const OrderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(ordersProvider);
    final rows = AppConfig.hasSupabase ? (state.valueOrNull ?? const []) : _demoOrders;
    return Scaffold(
      appBar: AppBar(title: const Text('My Orders'), actions: [
        IconButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProductCatalogScreen())), icon: const Icon(Icons.add_shopping_cart_outlined), tooltip: 'New order'),
      ]),
      body: state.isLoading && AppConfig.hasSupabase
          ? const Center(child: CircularProgressIndicator())
          : state.hasError && AppConfig.hasSupabase
              ? _OrderError(onRetry: () => ref.invalidate(ordersProvider))
              : rows.isEmpty
                  ? _EmptyOrders(onNewOrder: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProductCatalogScreen())))
                  : RefreshIndicator(
                      onRefresh: () => ref.refresh(ordersProvider.future).then((_) {}),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: rows.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, index) => _OrderCard(row: rows[index]),
                      ),
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProductCatalogScreen())),
        icon: const Icon(Icons.add),
        label: const Text('New Order'),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.row});
  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final status = row['status']?.toString() ?? 'submitted';
    final created = DateTime.tryParse(row['created_at']?.toString() ?? '');
    final items = (row['agri_order_items'] as List?) ?? const [];
    final color = switch (status) {
      'completed' || 'delivered' || 'approved' => AppColors.green,
      'cancelled' || 'rejected' => Colors.red,
      'processing' || 'dispatched' || 'in_transit' => Colors.blue,
      _ => Colors.orange,
    };
    final total = (row['grand_total'] as num?)?.toDouble() ?? 0;
    return Card(child: InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => showModalBottomSheet(context: context, showDragHandle: true, builder: (_) => _OrderDetails(row: row)),
      child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(row['order_number']?.toString() ?? 'Order', style: const TextStyle(fontWeight: FontWeight.w800))),
          Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(20)), child: Text(label(status), style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800))),
        ]),
        const SizedBox(height: 8),
        Text(items.isEmpty ? 'Order items' : items.take(2).map((item) => item['product_name']).join(', '), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted)),
        const Divider(height: 24),
        Row(children: [
          Text(created == null ? '' : DateFormat('dd MMM yyyy').format(created.toLocal()), style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          const Spacer(), Text('Rs ${NumberFormat('#,##0').format(total)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.green)),
          const SizedBox(width: 5), const Icon(Icons.chevron_right, size: 18),
        ]),
      ])),
    ));
  }

  static String label(String status) => status.replaceAll('_', ' ').split(' ').map((word) => word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}').join(' ');
}

class _OrderDetails extends StatelessWidget {
  const _OrderDetails({required this.row});
  final Map<String, dynamic> row;
  @override Widget build(BuildContext context) {
    final items = (row['agri_order_items'] as List?) ?? const [];
    return SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(row['order_number']?.toString() ?? 'Order', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
      Text('Status: ${_OrderCard.label(row['status']?.toString() ?? 'submitted')} • ${row['payment_terms'] ?? 'Cash'}', style: const TextStyle(color: AppColors.muted)),
      const Divider(height: 28),
      if (items.isEmpty) const Text('Item detail available nahi.')
      else ...items.map((item) => ListTile(contentPadding: EdgeInsets.zero, title: Text(item['product_name']?.toString() ?? 'Product'), subtitle: Text(item['pack_size']?.toString() ?? ''), trailing: Text('× ${item['order_qty'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w800)))),
    ])));
  }
}

class _EmptyOrders extends StatelessWidget {
  const _EmptyOrders({required this.onNewOrder});
  final VoidCallback onNewOrder;
  @override Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.receipt_long_outlined, size: 56, color: AppColors.muted), const SizedBox(height: 10), const Text('Abhi koi order nahi.'), const SizedBox(height: 10), FilledButton(onPressed: onNewOrder, child: const Text('Pehla order karein'))]));
}

class _OrderError extends StatelessWidget {
  const _OrderError({required this.onRetry});
  final VoidCallback onRetry;
  @override Widget build(BuildContext context) => Center(child: TextButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Orders dobara load karein')));
}

const _demoOrders = <Map<String, dynamic>>[
  {'order_number': 'MOB-DEMO-001', 'status': 'approved', 'grand_total': 42200, 'payment_terms': 'Credit', 'agri_order_items': [{'product_name': 'Engro Urea', 'order_qty': 10, 'pack_size': '50 kg'}]},
  {'order_number': 'MOB-DEMO-002', 'status': 'processing', 'grand_total': 12800, 'payment_terms': 'Cash', 'agri_order_items': [{'product_name': '1718 Rice Seed', 'order_qty': 2, 'pack_size': '20 kg'}]},
];
