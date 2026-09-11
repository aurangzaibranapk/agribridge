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

  Future<void> submit() async {
    setState(() { busy = true; error = null; });
    try {
      final auth = ref.read(authRepositoryProvider);
      if (!sent) {
        await auth.sendOtp(phone.text.trim());
        setState(() => sent = true);
      } else {
        await auth.verifyOtp(phone.text.trim(), otp.text.trim());
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
              if (!AppConfig.hasSupabase) ...[
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
