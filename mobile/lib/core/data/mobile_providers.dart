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
