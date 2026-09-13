import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../core/config/app_config.dart';
import '../../core/data/mobile_providers.dart';
import 'cart_controller.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});
  @override ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  String payment = 'Cash on Delivery';
  bool submitting = false;
  @override Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final total = cart.values.fold<double>(0, (sum, line) => sum + line.total);
    return Scaffold(appBar: AppBar(title: const Text('Review Order')), body: cart.isEmpty ? const Center(child: Text('Cart abhi khali hai.')) : ListView(padding: const EdgeInsets.all(16), children: [
      ...cart.values.map((line) => Card(child: ListTile(title: Text(line.product.name, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${line.quantity} × Rs ${line.product.price.toStringAsFixed(0)}'), trailing: Text('Rs ${line.total.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800))))),
      const SizedBox(height: 16), const Text('Payment Method', style: TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 8),
      DropdownButtonFormField<String>(initialValue: payment, items: ['Cash on Delivery', 'Shop Pickup Payment', 'Customer Khata', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Advance Payment'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(), onChanged: (v) => setState(() => payment = v!)),
      const SizedBox(height: 18), Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [const Expanded(child: Text('Grand Total', style: TextStyle(fontWeight: FontWeight.w700))), Text('Rs ${total.toStringAsFixed(0)}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.green))]))),
      const SizedBox(height: 16), FilledButton.icon(onPressed: submitting ? null : () => _submit(cart.values), icon: submitting ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.verified_outlined), label: Text(submitting ? 'Submit ho raha hai…' : 'Order Confirm Karein'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54))),
    ]));
  }

  Future<void> _submit(Iterable<CartLine> lines) async {
    if (!AppConfig.hasSupabase) {
      await showDialog(context: context, builder: (_) => AlertDialog(title: const Text('Testing Preview'), content: const Text('Supabase testing keys lagne ke baad order secure database function se submit hoga.'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Theek hai'))]));
      return;
    }
    setState(() => submitting = true);
    try {
      final id = await ref.read(mobileRepositoryProvider).submitOrder(lines: lines, paymentMethod: payment);
      ref.read(cartProvider.notifier).clear();
      if (!mounted) return;
      await showDialog(context: context, builder: (_) => AlertDialog(title: const Text('Order Submit Ho Gaya'), content: Text('Reference: $id'), actions: [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Theek hai'))]));
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order submit nahi hua. Products aur internet check karke dobara koshish karein.')));
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }
}
