import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

class MobileRepository {
  SupabaseClient get _client => Supabase.instance.client;

  Future<List<Map<String, dynamic>>> activeProducts({int limit = 30}) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.from('products').select().eq('is_active', true).limit(limit);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> myOrders(String profileId) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.from('agri_orders').select().eq('requested_by', profileId).order('created_at', ascending: false).limit(30);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> myNotifications(String profileId) async {
    if (!AppConfig.hasSupabase) return const [];
    final rows = await _client.from('notifications').select().eq('recipient_user_id', profileId).order('created_at', ascending: false).limit(40);
    return List<Map<String, dynamic>>.from(rows);
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
}
