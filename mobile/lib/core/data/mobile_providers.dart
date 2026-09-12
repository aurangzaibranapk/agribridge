import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/commerce/product.dart';
import '../auth/session_controller.dart';
import '../config/app_config.dart';
import '../permissions/permission_repository.dart';
import 'mobile_repository.dart';

final mobileRepositoryProvider = Provider((_) => MobileRepository());
final permissionRepositoryProvider = Provider((_) => PermissionRepository());

final productsProvider = FutureProvider<List<Product>>((ref) async {
  if (AppConfig.demoMode) return demoProducts;
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
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

final serviceRequestsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return const [];
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  return ref.read(mobileRepositoryProvider).myServiceRequests();
});

final farmerSummaryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  if (AppConfig.demoMode) return demoFarmerSummary;
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  return ref.read(mobileRepositoryProvider).myFarmerSummary();
});

final roleDashboardSummaryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  if (AppConfig.demoMode) return demoRoleDashboardSummary;
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  return ref.read(mobileRepositoryProvider).roleDashboardSummary();
});

const demoRoleDashboardSummary = <String, dynamic>{
  'today_orders': 12,
  'today_order_value': 285400,
  'pending_orders': 5,
  'unread_notifications': 3,
  'allowed_features': 18,
  'open_service_requests': 2,
  'dealer_payable': 156000,
};

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
