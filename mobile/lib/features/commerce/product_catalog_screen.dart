import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import 'cart_controller.dart';
import 'cart_screen.dart';
import 'product.dart';

class ProductCatalogScreen extends ConsumerStatefulWidget {
  const ProductCatalogScreen({super.key});
  @override ConsumerState<ProductCatalogScreen> createState() => _ProductCatalogScreenState();
}

class _ProductCatalogScreenState extends ConsumerState<ProductCatalogScreen> {
  String query = '';
  String category = 'All';

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final categories = ['All', ...{for (final p in demoProducts) p.category}];
    final products = demoProducts.where((p) => (category == 'All' || p.category == category) && '${p.name} ${p.brand} ${p.category}'.toLowerCase().contains(query.toLowerCase())).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Products'), actions: [
        IconButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen())), icon: Badge(label: Text('${cart.values.fold<int>(0, (s, e) => s + e.quantity)}'), child: const Icon(Icons.shopping_bag_outlined))),
      ]),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 8), child: TextField(onChanged: (v) => setState(() => query = v), decoration: const InputDecoration(hintText: 'Product, brand ya category search karein', prefixIcon: Icon(Icons.search)))),
        SizedBox(height: 42, child: ListView.separated(padding: const EdgeInsets.symmetric(horizontal: 16), scrollDirection: Axis.horizontal, itemCount: categories.length, separatorBuilder: (_, __) => const SizedBox(width: 8), itemBuilder: (_, i) => ChoiceChip(label: Text(categories[i]), selected: category == categories[i], onSelected: (_) => setState(() => category = categories[i])))),
        const SizedBox(height: 8),
        Expanded(child: GridView.builder(padding: const EdgeInsets.all(16), gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: .67, crossAxisSpacing: 12, mainAxisSpacing: 12), itemCount: products.length, itemBuilder: (_, i) => _ProductCard(product: products[i]))),
      ]),
    );
  }
}

class _ProductCard extends ConsumerWidget {
  const _ProductCard({required this.product}); final Product product;
  @override Widget build(BuildContext context, WidgetRef ref) {
    final quantity = ref.watch(cartProvider)[product.id]?.quantity ?? 0;
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(child: Container(decoration: BoxDecoration(color: AppColors.mint, borderRadius: BorderRadius.circular(14)), child: Center(child: Icon(product.category == 'Animal Feed' ? Icons.pets : product.category == 'Seed' ? Icons.grass : Icons.science_outlined, size: 52, color: AppColors.green)))),
      const SizedBox(height: 10), Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
      Text('${product.brand ?? ''} • ${product.pack}', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
      const SizedBox(height: 7), Text('Rs ${product.price.toStringAsFixed(0)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.green)),
      Text('Warehouse ${product.warehouseStock.toStringAsFixed(0)} • Shop ${product.shopStock.toStringAsFixed(0)}', style: const TextStyle(fontSize: 9, color: AppColors.muted)),
      const SizedBox(height: 8),
      quantity == 0 ? FilledButton(onPressed: () => ref.read(cartProvider.notifier).add(product), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(38)), child: const Text('Add')) : Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [IconButton.filledTonal(onPressed: () => ref.read(cartProvider.notifier).removeOne(product), icon: const Icon(Icons.remove, size: 16)), Text('$quantity', style: const TextStyle(fontWeight: FontWeight.w800)), IconButton.filled(onPressed: () => ref.read(cartProvider.notifier).add(product), icon: const Icon(Icons.add, size: 16))]),
    ])));
  }
}
