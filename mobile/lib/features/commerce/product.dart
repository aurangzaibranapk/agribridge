class Product {
  const Product({required this.id, required this.name, required this.category, required this.pack, required this.price, required this.warehouseStock, required this.shopStock, this.brand, this.batch, this.expiry});
  final String id;
  final String name;
  final String category;
  final String pack;
  final double price;
  final double warehouseStock;
  final double shopStock;
  final String? brand;
  final String? batch;
  final DateTime? expiry;

  factory Product.fromRow(Map<String, dynamic> row) {
    String relationName(String key, String fallback) {
      final value = row[key];
      return value is Map ? (value['name']?.toString() ?? fallback) : fallback;
    }
    double number(String key) => (row[key] as num?)?.toDouble() ?? 0;
    return Product(
      id: row['id'].toString(),
      name: row['name']?.toString() ?? 'Product',
      category: row['category_name']?.toString() ?? relationName('categories', 'Other'),
      pack: row['pack_size']?.toString() ?? row['unit']?.toString() ?? 'Unit',
      price: number('selling_price'),
      warehouseStock: number('warehouse_stock'),
      shopStock: number('shop_stock'),
      brand: row['brand_name']?.toString() ?? relationName('brands', ''),
      batch: row['batch_number']?.toString(),
      expiry: DateTime.tryParse(row['expiry_date']?.toString() ?? ''),
    );
  }
}

const demoProducts = [
  Product(id: 'p1', name: 'Engro Urea', category: 'Fertilizer', pack: '50 kg', price: 4220, warehouseStock: 280, shopStock: 42, brand: 'Engro', batch: 'EU-2609'),
  Product(id: 'p2', name: 'Sona Urea', category: 'Fertilizer', pack: '50 kg', price: 4220, warehouseStock: 190, shopStock: 31, brand: 'FFC', batch: 'SU-2610'),
  Product(id: 'p3', name: 'Engro DAP', category: 'Fertilizer', pack: '50 kg', price: 14600, warehouseStock: 84, shopStock: 12, brand: 'Engro', batch: 'DAP-2611'),
  Product(id: 'p4', name: '1718 Rice Seed', category: 'Seed', pack: '20 kg', price: 6400, warehouseStock: 73, shopStock: 9, brand: 'Certified', batch: 'RS-1718'),
  Product(id: 'p5', name: 'Dairy Lac Wanda', category: 'Animal Feed', pack: '40 kg', price: 3950, warehouseStock: 125, shopStock: 18, brand: 'Dairy Lac', batch: 'DL-2608'),
  Product(id: 'p6', name: 'Humic Acid', category: 'Crop Nutrition', pack: '1 L', price: 1750, warehouseStock: 55, shopStock: 7, brand: 'AgriBridge', batch: 'HA-2609'),
];
