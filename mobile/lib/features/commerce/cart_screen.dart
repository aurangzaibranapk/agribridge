import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import 'cart_controller.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});
  @override ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  String payment = 'Cash on Delivery';
  @override Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final total = cart.values.fold<double>(0, (sum, line) => sum + line.total);
    return Scaffold(appBar: AppBar(title: const Text('Review Order')), body: cart.isEmpty ? const Center(child: Text('Cart abhi khali hai.')) : ListView(padding: const EdgeInsets.all(16), children: [
      ...cart.values.map((line) => Card(child: ListTile(title: Text(line.product.name, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${line.quantity} × Rs ${line.product.price.toStringAsFixed(0)}'), trailing: Text('Rs ${line.total.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800))))),
      const SizedBox(height: 16), const Text('Payment Method', style: TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 8),
      DropdownButtonFormField<String>(initialValue: payment, items: ['Cash on Delivery', 'Shop Pickup Payment', 'Customer Khata', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Advance Payment'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(), onChanged: (v) => setState(() => payment = v!)),
      const SizedBox(height: 18), Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [const Expanded(child: Text('Grand Total', style: TextStyle(fontWeight: FontWeight.w700))), Text('Rs ${total.toStringAsFixed(0)}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.green))]))),
      const SizedBox(height: 16), FilledButton.icon(onPressed: () => showDialog(context: context, builder: (_) => AlertDialog(title: const Text('Order Review Ready'), content: const Text('Testing mode mein order database mein post nahi kiya gaya. Production submission RLS verification ke baad enable hogi.'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Theek hai'))])), icon: const Icon(Icons.verified_outlined), label: const Text('Order Confirm Karein'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54))),
    ]));
  }
}
