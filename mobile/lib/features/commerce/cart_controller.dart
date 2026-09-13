import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'product.dart';

class CartLine {
  const CartLine(this.product, this.quantity);
  final Product product;
  final int quantity;
  double get total => product.price * quantity;
}

final cartProvider = NotifierProvider<CartController, Map<String, CartLine>>(CartController.new);

class CartController extends Notifier<Map<String, CartLine>> {
  @override
  Map<String, CartLine> build() => {};

  void add(Product product) {
    final current = state[product.id];
    state = {...state, product.id: CartLine(product, (current?.quantity ?? 0) + 1)};
  }

  void removeOne(Product product) {
    final current = state[product.id];
    if (current == null) return;
    if (current.quantity <= 1) {
      state = {...state}..remove(product.id);
    } else {
      state = {...state, product.id: CartLine(product, current.quantity - 1)};
    }
  }

  void clear() => state = {};
}
