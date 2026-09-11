import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../models/app_role.dart';
import 'auth_repository.dart';

final authRepositoryProvider = Provider((_) => AuthRepository());

final sessionProvider = AsyncNotifierProvider<SessionController, AppProfile?>(
  SessionController.new,
);

class SessionController extends AsyncNotifier<AppProfile?> {
  @override
  Future<AppProfile?> build() async {
    if (!AppConfig.hasSupabase) return null;
    return ref.read(authRepositoryProvider).currentProfile();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).currentProfile(),
    );
  }

  void useDemoRole(AppRole role) {
    state = AsyncData(AppProfile(
      id: 'demo-${role.name}',
      name: switch (role) {
        AppRole.admin => 'Admin User',
        AppRole.farmer => 'Kisan Bhai',
        AppRole.staff => 'Anwar Ul Hassan',
        AppRole.dealer => 'Dealer',
        _ => 'Customer',
      },
      role: role,
      rawRole: role.name,
      branchId: 'testing-branch',
      shopId: 'testing-shop',
    ));
  }
}
