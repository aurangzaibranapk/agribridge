import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../../features/commerce/cart_controller.dart';

class MobileRepository {
  SupabaseClient get _client => Supabase.instance.client;

  Future<List<Map<String, dynamic>>> activeProducts({int limit = 30}) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.rpc('mobile_product_catalog', params: {'p_limit': limit});
    return List<Map<String, dynamic>>.from(rows);
  }

  /// Server (584) profile se organization/branch/shop khud bharta hai.
  Future<void> submitServiceRequest({required String type, required Map<String, String> details}) async {
    if (!AppConfig.hasSupabase) throw StateError('Supabase configured nahi.');
    if (_client.auth.currentUser == null) throw StateError('Login zaroori hai.');
    await _client.rpc('mobile_submit_service_request', params: {'p_type': type, 'p_details': details});
  }

  Future<List<Map<String, dynamic>>> officeServiceRequests() async {
    if (!AppConfig.hasSupabase) return const [];
    final user = _client.auth.currentUser;
    if (user == null) throw StateError('Login zaroori hai.');
    // RLS limits this query to the authenticated admin's organization.
    final rows = await _client
        .from('mobile_service_requests')
        .select('id, profile_id, request_type, details, status, created_at, requester:profiles!mobile_service_requests_profile_id_fkey(full_name)')
        .order('created_at', ascending: false)
        .limit(100);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> updateOfficeServiceRequest({required String id, required String status}) async {
    if (!AppConfig.hasSupabase) throw StateError('Supabase configured nahi.');
    const allowed = {'submitted', 'in_review', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled'};
    if (!allowed.contains(status)) throw ArgumentError.value(status, 'status');
    final row = await _client
        .from('mobile_service_requests')
        .update({'status': status}) // updated_at/decided_by server trigger (584) bharta hai
        .eq('id', id)
        .select('id')
        .maybeSingle();
    if (row == null) throw StateError('Request update nahi hui; access check karein.');
  }

  Future<List<Map<String, dynamic>>> myServiceRequests() async {
    if (!AppConfig.hasSupabase) return const [];
    final user = _client.auth.currentUser;
    if (user == null) return const [];
    final rows = await _client
        .from('mobile_service_requests')
        .select('id, request_type, details, status, created_at, updated_at')
        .eq('profile_id', user.id)
        .order('created_at', ascending: false)
        .limit(30);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> myOrders(String profileId) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client
        .from('agri_orders')
        .select('id, order_number, status, grand_total, payment_terms, created_at, agri_order_items(product_name, order_qty, pack_size)')
        .eq('requested_by', profileId)
        .order('created_at', ascending: false)
        .limit(30);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> myNotifications(String profileId) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.from('notifications').select().eq('recipient_user_id', profileId).order('created_at', ascending: false).limit(40);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> markAllNotificationsRead(String profileId) async {
    if (!AppConfig.hasSupabase) return;
    await _client.from('notifications').update({'is_read': true}).eq('recipient_user_id', profileId).eq('is_read', false);
  }

  /// 583: token sirf security-definer function se likha jata hai.
  Future<void> registerDevice({required String token, required String platform}) async {
    if (!AppConfig.hasSupabase) return;
    if (_client.auth.currentUser == null) return;
    await _client.rpc('mobile_register_device', params: {
      'p_token': token,
      'p_platform': platform,
      'p_environment': AppConfig.isProduction ? 'production' : 'testing',
      'p_app_version': AppConfig.appVersion,
    });
  }

  /// 583: darkhwast 580 ki admin queue (portal_account_delete_requests) mein jati hai.
  Future<void> requestAccountDeletion(String reason) async {
    if (!AppConfig.hasSupabase) throw StateError('Supabase configured nahi.');
    if (_client.auth.currentUser == null) throw StateError('Login zaroori hai.');
    await _client.rpc('mobile_request_account_deletion', params: {'p_reason': reason});
  }

  Future<Map<String, dynamic>?> myAccountDeletion() async {
    if (!AppConfig.hasSupabase) return null;
    final result = await _client.rpc('mobile_my_account_deletion');
    return result == null ? null : Map<String, dynamic>.from(result as Map);
  }

  Future<String> submitOrder({
    required Iterable<CartLine> lines,
    required String paymentMethod,
    String? notes,
  }) async {
    if (!AppConfig.hasSupabase) throw StateError('Testing demo mein order database ko nahi bheja jata.');
    // Server (588) khata/udhaar order mobile se qubool nahi karta.
    final paymentTerms = switch (paymentMethod) {
      'Bank Transfer' || 'Easypaisa' || 'JazzCash' => 'Bank Transfer',
      'Advance Payment' => 'Advance Payment',
      _ => 'Cash',
    };
    final result = await _client.rpc('mobile_submit_agri_order', params: {
      'p_items': [for (final line in lines) {'product_id': line.product.id, 'quantity': line.quantity}],
      'p_payment_terms': paymentTerms,
      'p_notes': notes,
    });
    return result.toString();
  }

  Future<Map<String, dynamic>> myGrainSummary() async {
    if (!AppConfig.hasSupabase) throw StateError('Supabase configured nahi.');
    final result = await _client.rpc('mobile_my_grain_summary');
    return Map<String, dynamic>.from(result as Map);
  }

  Future<List<Map<String, dynamic>>> myMachineryBookings() async {
    if (!AppConfig.hasSupabase) throw StateError('Supabase configured nahi.');
    final result = await _client.rpc('mobile_my_machinery_bookings');
    return List<Map<String, dynamic>>.from(result as List);
  }

  Future<Map<String, dynamic>> myFarmerSummary() async {
    if (!AppConfig.hasSupabase) return const {};
    final result = await _client.rpc('mobile_my_farmer_summary');
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> roleDashboardSummary() async {
    if (!AppConfig.hasSupabase) return const {};
    final result = await _client.rpc('mobile_role_dashboard_summary');
    return Map<String, dynamic>.from(result as Map);
  }

  // ---- Main ke portal functions (565-577), sab auth.uid() par, read-only ----

  /// 565: ek hi khata (karyana, khaad, doodh, gandum, machinery, qist...).
  Future<Map<String, dynamic>?> myKhataSummary() async {
    if (!AppConfig.hasSupabase) return null;
    final result = await _client.rpc('fn_my_khata_summary');
    return result == null ? null : Map<String, dynamic>.from(result as Map);
  }

  /// 565: chalta baqaya. [from]/[to] Asia/Karachi tareekh.
  Future<List<Map<String, dynamic>>> myKhataStatement({DateTime? from, DateTime? to}) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.rpc('fn_my_khata_statement', params: {
      'p_from': from == null ? null : isoDate(from),
      'p_to': to == null ? null : isoDate(to),
    });
    return List<Map<String, dynamic>>.from(rows as List);
  }

  /// 572: dukaan ke bill.
  Future<List<Map<String, dynamic>>> myBills({int limit = 50}) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.rpc('fn_my_bills', params: {'p_limit': limit});
    return List<Map<String, dynamic>>.from(rows as List);
  }

  /// 572: khata ki adaigiyan.
  Future<List<Map<String, dynamic>>> myPayments() async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.rpc('fn_my_payments');
    return List<Map<String, dynamic>>.from(rows as List);
  }

  /// 567: markaz par diya gaya doodh (din-waar subah/shaam).
  Future<List<Map<String, dynamic>>> myMilkCollection({required DateTime from, required DateTime to}) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.rpc('fn_my_milk_collection', params: {'p_from': isoDate(from), 'p_to': isoDate(to)});
    return List<Map<String, dynamic>>.from(rows as List);
  }

  /// 571: janwaron ke aane wale kaam (breeding, vaccine, dry-off...).
  Future<List<Map<String, dynamic>>> myDueTasks({int days = 30}) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.rpc('fn_my_due_tasks', params: {'p_days': days});
    return List<Map<String, dynamic>>.from(rows as List);
  }

  /// 573: customer portal ki darkhwastein (adaigi saboot, tabdeeli, shikayat, wade).
  Future<Map<String, dynamic>?> myPortalRequests() async {
    if (!AppConfig.hasSupabase) return null;
    final result = await _client.rpc('fn_my_requests');
    return result == null ? null : Map<String, dynamic>.from(result as Map);
  }
}

String isoDate(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
