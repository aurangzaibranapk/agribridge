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

  test('product maps secure mobile catalog stock fields', () {
    final product = Product.fromRow({
      'id': 'p-2',
      'name': 'DAP',
      'pack_size': '50 kg',
      'selling_price': 12450.5,
      'category_name': 'Fertilizer',
      'brand_name': 'FFC',
      'warehouse_stock': 25,
      'shop_stock': 8.5,
    });

    expect(product.category, 'Fertilizer');
    expect(product.brand, 'FFC');
    expect(product.warehouseStock, 25);
    expect(product.shopStock, 8.5);
  });
}
