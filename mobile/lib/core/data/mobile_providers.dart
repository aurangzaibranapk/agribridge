import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/commerce/product.dart';
import '../auth/session_controller.dart';
import '../config/app_config.dart';
import '../permissions/permission_repository.dart';
import 'mobile_repository.dart';

final mobileRepositoryProvider = Provider((_) => MobileRepository());
final permissionRepositoryProvider = Provider((_) => PermissionRepository());

final productsProvider = FutureProvider<List<Product>>((ref) async {
  if (!AppConfig.hasSupabase) return demoProducts;
  final rows = await ref.read(mobileRepositoryProvider).activeProducts(limit: 100);
  return rows.map(Product.fromRow).toList();
});

final permissionsProvider = FutureProvider<Map<String, MobilePermission>>((ref) async {
  return ref.read(permissionRepositoryProvider).forCurrentUser();
});

final notificationsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final profile = ref.watch(sessionProvider).valueOrNull;
  if (profile == null || !AppConfig.hasSupabase) return const [];
  return ref.read(mobileRepositoryProvider).myNotifications(profile.id);
});

final ordersProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final profile = ref.watch(sessionProvider).valueOrNull;
  if (profile == null || !AppConfig.hasSupabase) return const [];
  return ref.read(mobileRepositoryProvider).myOrders(profile.id);
});

final farmerSummaryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  if (!AppConfig.hasSupabase) return demoFarmerSummary;
  return ref.read(mobileRepositoryProvider).myFarmerSummary();
});

const demoFarmerSummary = <String, dynamic>{
  'milk_balance': 42850,
  'credit_balance': 14400,
  'wallet_balance': 28450,
  'week_liters': 742,
  'week_amount': 158000,
  'avg_fat': 3.9,
  'avg_snf': 9.2,
  'transactions': [
    {'category': 'Milk', 'title': 'Weekly milk collection', 'amount': 42850, 'incoming': true, 'happened_at': '2026-09-10T00:00:00Z'},
    {'category': 'Fertilizer', 'title': 'Engro Urea × 4', 'amount': 16880, 'incoming': false, 'happened_at': '2026-09-02T00:00:00Z'},
  ],
};
