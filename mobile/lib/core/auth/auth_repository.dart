import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../models/app_role.dart';

class AuthRepository {
  SupabaseClient? get _client =>
      AppConfig.hasSupabase ? Supabase.instance.client : null;

  Stream<AuthState> get authChanges =>
      _client?.auth.onAuthStateChange ?? const Stream.empty();

  Future<void> sendOtp(String phone) async {
    final client = _client;
    if (client == null) throw StateError('Supabase environment configured nahi.');
    await client.auth.signInWithOtp(phone: phone);
  }

  Future<void> verifyOtp(String phone, String token) async {
    final client = _client;
    if (client == null) throw StateError('Supabase environment configured nahi.');
    await client.auth.verifyOTP(phone: phone, token: token, type: OtpType.sms);
  }

  Future<AppProfile?> currentProfile() async {
    final client = _client;
    final user = client?.auth.currentUser;
    if (client == null || user == null) return null;
    final row = await client
        .from('profiles')
        .select('id, full_name, role, branch_id, shop_id, is_active')
        .eq('id', user.id)
        .eq('is_active', true)
        .maybeSingle();
    if (row == null) return null;
    final rawRole = row['role'] as String?;
    return AppProfile(
      id: row['id'] as String,
      name: (row['full_name'] as String?) ?? 'User',
      role: AppRoleX.fromDatabase(rawRole),
      rawRole: rawRole,
      branchId: row['branch_id'] as String?,
      shopId: row['shop_id'] as String?,
    );
  }

  Future<void> signOut() async => _client?.auth.signOut();
}
