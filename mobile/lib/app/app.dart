import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/session_controller.dart';
import '../core/config/app_config.dart';
import '../core/connectivity/connectivity_provider.dart';
import '../core/notifications/push_service.dart';
import '../core/theme/app_theme.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/role_dashboard.dart';

class AgriBridgeApp extends ConsumerWidget {
  const AgriBridgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    ref.listen(sessionProvider, (_, next) {
      if (next.valueOrNull != null && AppConfig.firebaseMessagingEnabled) {
        unawaited(PushService.syncForSignedInUser());
      }
    });
    final offline = isOffline(ref.watch(connectivityProvider).valueOrNull);
    return MaterialApp(
      title: 'Al Rana Traders — AgriBridge',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      builder: (context, child) => Column(children: [
        if (offline) const Material(color: Color(0xFF9A6700), child: SafeArea(bottom: false, child: SizedBox(height: 28, child: Center(child: Text('Offline — saved data hi nazar aa sakta hai', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)))))),
        Expanded(child: child ?? const SizedBox.shrink()),
      ]),
      home: session.when(
        loading: () => const _Splash(),
        error: (error, _) => LoginScreen(initialError: '$error'),
        data: (profile) =>
            profile == null ? const LoginScreen() : RoleDashboard(profile: profile),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: AppColors.navy,
        body: Center(
          child: CircularProgressIndicator(color: Colors.white),
        ),
      );
}
