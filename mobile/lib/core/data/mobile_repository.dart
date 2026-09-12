import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../../features/commerce/cart_controller.dart';

class MobileRepository {
  SupabaseClient get _client => Supabase.instance.client;

  Future<List<Map<String, dynamic>>> activeProducts({int limit = 30}) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client
        .from('products')
        .select('id, name, pack_size, unit, selling_price, image_url, expiry_date, categories(name), brands(name)')
        .eq('is_available', true)
        .eq('is_deleted', false)
        .order('name')
        .limit(limit);
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

  Future<void> registerDevice({required String token, required String platform}) async {
    if (!AppConfig.hasSupabase) return;
    final user = _client.auth.currentUser;
    if (user == null) return;
    await _client.from('mobile_devices').upsert({
      'profile_id': user.id,
      'push_token': token,
      'platform': platform,
      'app_environment': AppConfig.environment,
      'last_seen_at': DateTime.now().toUtc().toIso8601String(),
    }, onConflict: 'push_token');
  }

  Future<void> requestAccountDeletion(String reason) async {
    if (!AppConfig.hasSupabase) throw StateError('Supabase configured nahi.');
    final user = _client.auth.currentUser;
    if (user == null) throw StateError('Login zaroori hai.');
    await _client.from('account_deletion_requests').insert({'profile_id': user.id, 'reason': reason});
  }

  Future<String> submitOrder({
    required Iterable<CartLine> lines,
    required String paymentMethod,
    String? notes,
  }) async {
    if (!AppConfig.hasSupabase) throw StateError('Testing demo mein order database ko nahi bheja jata.');
    final paymentTerms = switch (paymentMethod) {
      'Bank Transfer' || 'Easypaisa' || 'JazzCash' => 'Bank Transfer',
      'Customer Khata' => 'Credit',
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
}
