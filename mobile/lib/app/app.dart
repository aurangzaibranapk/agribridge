import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/session_controller.dart';
import '../core/theme/app_theme.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/role_dashboard.dart';

class AgriBridgeApp extends ConsumerWidget {
  const AgriBridgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return MaterialApp(
      title: 'Al Rana Traders — AgriBridge',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
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
