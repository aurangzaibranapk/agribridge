import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/models/app_role.dart';
import '../../core/theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.initialError});
  final String? initialError;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final phone = TextEditingController(text: '+92');
  final otp = TextEditingController();
  bool sent = false;
  bool busy = false;
  String? error;

  @override
  void dispose() {
    phone.dispose();
    otp.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!AppConfig.hasSupabase) {
      setState(() => error = AppConfig.isProduction
          ? 'App configuration missing. Support se rabta karein.'
          : 'Testing preview role chunein.');
      return;
    }
    final mobile = phone.text.replaceAll(RegExp(r'\s+'), '');
    if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(mobile)) {
      setState(() => error = 'Mobile international format mein likhein, misal +923126513294.');
      return;
    }
    if (sent && !RegExp(r'^\d{4,8}$').hasMatch(otp.text.trim())) {
      setState(() => error = 'Durust OTP code likhein.');
      return;
    }
    setState(() { busy = true; error = null; });
    try {
      final auth = ref.read(authRepositoryProvider);
      if (!sent) {
        await auth.sendOtp(mobile);
        setState(() => sent = true);
      } else {
        await auth.verifyOtp(mobile, otp.text.trim());
        await ref.read(sessionProvider.notifier).refresh();
      }
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 36),
              const CircleAvatar(
                radius: 38,
                backgroundColor: AppColors.green,
                child: Icon(Icons.eco_rounded, color: Colors.white, size: 42),
              ),
              const SizedBox(height: 18),
              const Text('Al Rana Traders', textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.navy)),
              const Text('AgriBridge', textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, letterSpacing: 2, color: AppColors.green)),
              const SizedBox(height: 36),
              TextField(controller: phone, keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Mobile Number', prefixIcon: Icon(Icons.phone_outlined))),
              if (sent) ...[
                const SizedBox(height: 12),
                TextField(controller: otp, keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'OTP Code', prefixIcon: Icon(Icons.lock_outline))),
              ],
              if (error ?? widget.initialError case final message?)
                Padding(padding: const EdgeInsets.only(top: 12), child: Text(message, style: const TextStyle(color: Colors.red))),
              const SizedBox(height: 16),
              FilledButton(onPressed: busy ? null : submit,
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                  child: Text(busy ? 'Please wait...' : sent ? 'Login Karein' : 'OTP Bhejein')),
              if (AppConfig.demoMode) ...[
                const SizedBox(height: 30),
                const Text('Testing Preview', textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center,
                  children: [AppRole.admin, AppRole.farmer, AppRole.staff, AppRole.dealer]
                    .map((role) => OutlinedButton(
                      onPressed: () => ref.read(sessionProvider.notifier).useDemoRole(role),
                      child: Text(role.label),
                    )).toList()),
              ],
            ],
          ),
        ),
      );
}
