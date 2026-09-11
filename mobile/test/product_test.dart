import 'package:agribridge/features/commerce/product.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('product maps safely from Supabase row', () {
    final product = Product.fromRow({
      'id': 'p-1',
      'name': 'Engro Urea',
      'pack_size': '50 kg',
      'selling_price': 4220,
      'categories': {'name': 'Fertilizer'},
      'brands': {'name': 'Engro'},
    });

    expect(product.name, 'Engro Urea');
    expect(product.category, 'Fertilizer');
    expect(product.brand, 'Engro');
    expect(product.price, 4220);
    expect(product.warehouseStock, 0);
  });
}
