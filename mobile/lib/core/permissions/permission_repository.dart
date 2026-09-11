import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

class MobilePermission {
  const MobilePermission({required this.featureKey, required this.actions, required this.scope});
  final String featureKey;
  final Set<String> actions;
  final String scope;

  bool allows(String action) => actions.contains(action);
}

class PermissionRepository {
  Future<Map<String, MobilePermission>> forCurrentUser() async {
    if (!AppConfig.hasSupabase) return const {};
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) return const {};
    final rows = await client
        .from('user_feature_permissions')
        .select('feature_key, actions, data_scope')
        .eq('profile_id', user.id);
    return {
      for (final row in rows)
        row['feature_key'] as String: MobilePermission(
          featureKey: row['feature_key'] as String,
          actions: Set<String>.from((row['actions'] as List?) ?? const ['view']),
          scope: (row['data_scope'] as String?) ?? 'own_records',
        ),
    };
  }
}
