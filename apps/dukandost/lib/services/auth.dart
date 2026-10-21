import 'package:supabase_flutter/supabase_flutter.dart';

/// Phone OTP auth. [SupabaseAuthService] when a cloud project is configured via
/// --dart-define, otherwise [DemoAuthService] (local only, OTP 123456).
abstract class AuthService {
  bool get isDemo;
  bool get signedIn;
  Future<void> sendOtp(String phone);
  Future<bool> verify(String phone, String code);
  Future<void> signOut();
}

/// +92 3xx xxxxxxx -> +923xxxxxxxxx
String e164Pk(String input) {
  var d = input.replaceAll(RegExp(r'[^0-9]'), '');
  if (d.startsWith('92')) d = d.substring(2);
  if (d.startsWith('0')) d = d.substring(1);
  return '+92$d';
}

bool validPkMobile(String input) => RegExp(r'^\+923\d{9}$').hasMatch(e164Pk(input));

class SupabaseAuthService implements AuthService {
  SupabaseAuthService(this.client);
  final SupabaseClient client;
  @override
  bool get isDemo => false;
  @override
  bool get signedIn => client.auth.currentSession != null;
  @override
  Future<void> sendOtp(String phone) => client.auth.signInWithOtp(phone: e164Pk(phone));
  @override
  Future<bool> verify(String phone, String code) async {
    final r = await client.auth.verifyOTP(phone: e164Pk(phone), token: code, type: OtpType.sms);
    return r.session != null;
  }
  @override
  Future<void> signOut() => client.auth.signOut();
}

class DemoAuthService implements AuthService {
  DemoAuthService({bool signedIn = false}) : _in = signedIn;
  bool _in;
  @override
  bool get isDemo => true;
  @override
  bool get signedIn => _in;
  @override
  Future<void> sendOtp(String phone) async {}
  @override
  Future<bool> verify(String phone, String code) async => _in = code == '123456';
  @override
  Future<void> signOut() async => _in = false;
}
