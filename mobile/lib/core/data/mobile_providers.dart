import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/commerce/product.dart';
import '../models/app_role.dart';
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

final officeServiceRequestsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return const [];
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  final profile = ref.watch(sessionProvider).valueOrNull;
  if (profile == null || profile.role != AppRole.admin) return const [];
  return ref.read(mobileRepositoryProvider).officeServiceRequests();
});

final serviceRequestsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return const [];
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  return ref.read(mobileRepositoryProvider).myServiceRequests();
});

final farmerGrainSummaryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  if (AppConfig.demoMode) return const {'total_supplied': 0, 'total_paid': 0, 'balance_due': 0, 'entries': [], 'payments': []};
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  final profile = ref.watch(sessionProvider).valueOrNull;
  if (profile == null || profile.role != AppRole.farmer) return const {};
  return ref.read(mobileRepositoryProvider).myGrainSummary();
});

final farmerMachineryBookingsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return const [];
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  final profile = ref.watch(sessionProvider).valueOrNull;
  if (profile == null || profile.role != AppRole.farmer) return const [];
  return ref.read(mobileRepositoryProvider).myMachineryBookings();
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
  'farmer_id': 'demo',
  'khata_owed': 14400,
  'khata': demoKhataSummary,
  'wallet_balance': 28450,
  'week_liters': 742,
  'week_amount': 158000,
  'avg_fat': 3.9,
  'avg_snf': 9.2,
};

const demoKhataSummary = <String, dynamic>{
  'owed': 14400,
  'by_category': [
    {'category': 'khaad', 'udhaar': 16880, 'adaigi': 4000, 'balance': 12880, 'count': 3},
    {'category': 'karyana', 'udhaar': 7600, 'adaigi': 6080, 'balance': 1520, 'count': 9},
  ],
  'aging': {'d0_15': 7600, 'd16_30': 6800, 'd31_60': 0, 'd60_plus': 0, 'oldest_days': 24},
  'last_payment': {'date': '2026-10-12', 'amount': 4000},
};

const demoKhataStatement = <Map<String, dynamic>>[
  {'entry_date': '2026-10-02', 'ref': 'JE-1', 'category': 'khaad', 'kind': 'udhaar', 'tafseel': 'Engro Urea x4', 'udhaar': 16880, 'adaigi': 0, 'baqaya': 16880, 'is_opening': false},
  {'entry_date': '2026-10-12', 'ref': 'JE-2', 'category': 'adaigi', 'kind': 'adaigi', 'tafseel': 'Adaigi', 'udhaar': 0, 'adaigi': 4000, 'baqaya': 12880, 'is_opening': false},
  {'entry_date': '2026-10-16', 'ref': 'POS-1', 'category': 'karyana', 'kind': 'udhaar', 'tafseel': 'Coke 2L x1', 'udhaar': 1520, 'adaigi': 0, 'baqaya': 14400, 'is_opening': false},
];

/// 565 ka khulasa (kisan aur customer dono).
final khataSummaryProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  if (AppConfig.demoMode) return demoKhataSummary;
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  return ref.read(mobileRepositoryProvider).myKhataSummary();
});

/// 565 ka statement, pichhle 90 din (pichhla baqaya opening line mein).
final khataStatementProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return demoKhataStatement;
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  final from = DateTime.now().subtract(const Duration(days: 90));
  return ref.read(mobileRepositoryProvider).myKhataStatement(from: from);
});

final billsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return const [];
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  return ref.read(mobileRepositoryProvider).myBills();
});

final milkCollectionProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return const [];
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  final now = DateTime.now();
  return ref.read(mobileRepositoryProvider).myMilkCollection(from: now.subtract(const Duration(days: 30)), to: now);
});

final dueTasksProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return const [];
  if (!AppConfig.hasSupabase) throw StateError('App environment configured nahi.');
  final profile = ref.watch(sessionProvider).valueOrNull;
  if (profile == null || profile.role != AppRole.farmer) return const [];
  return ref.read(mobileRepositoryProvider).myDueTasks();
});

final accountDeletionProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  if (!AppConfig.hasSupabase) return null;
  return ref.read(mobileRepositoryProvider).myAccountDeletion();
});
