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
        .from('v_user_feature_access')
        .select('feature_key, actions, data_scope')
        .eq('profile_id', user.id);
    final result = <String, MobilePermission>{};
    for (final row in rows) {
      final key = row['feature_key'] as String;
      final incoming = Set<String>.from((row['actions'] as List?) ?? const ['view']);
      final existing = result[key];
      result[key] = MobilePermission(
        featureKey: key,
        actions: {...?existing?.actions, ...incoming},
        scope: _widestScope(existing?.scope, (row['data_scope'] as String?) ?? 'own_records'),
      );
    }
    return result;
  }

  String _widestScope(String? first, String second) {
    const rank = {'own_records': 0, 'own_shop': 1, 'own_branch': 2, 'all': 3};
    if (first == null) return second;
    return (rank[first] ?? 0) >= (rank[second] ?? 0) ? first : second;
  }
}
