import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/app.dart';
import 'app/providers.dart';
import 'data/db.dart';
import 'data/sync.dart';
import 'services/auth.dart';

/// Cloud backend is optional. Without these defines the app runs fully local
/// (demo OTP 123456). Pass a DukanDost-only project, never AgriBridge's:
///   --dart-define=DD_SUPABASE_URL=... --dart-define=DD_SUPABASE_ANON_KEY=...
const _url = String.fromEnvironment('DD_SUPABASE_URL');
const _key = String.fromEnvironment('DD_SUPABASE_ANON_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final db = AppDb(driftDatabase(name: 'dukandost'));
  AuthService auth = DemoAuthService(signedIn: prefs.getBool('demo_signed_in') ?? false);
  Remote? remote;
  if (_url.isNotEmpty && _key.isNotEmpty) {
    await Supabase.initialize(url: _url, publishableKey: _key);
    auth = SupabaseAuthService(Supabase.instance.client);
    remote = SupabaseRemote(Supabase.instance.client);
  }
  runApp(ProviderScope(overrides: [
    dbProvider.overrideWithValue(db),
    prefsProvider.overrideWithValue(prefs),
    authProvider.overrideWithValue(_Persisting(auth, prefs)),
    remoteProvider.overrideWithValue(remote),
  ], child: const DukanDostApp()));
}

/// Remembers demo sign-in across restarts.
class _Persisting implements AuthService {
  _Persisting(this.inner, this.prefs);
  final AuthService inner;
  final SharedPreferences prefs;
  @override
  bool get isDemo => inner.isDemo;
  @override
  bool get signedIn => inner.signedIn;
  @override
  Future<void> sendOtp(String phone) => inner.sendOtp(phone);
  @override
  Future<bool> verify(String phone, String code) async {
    final ok = await inner.verify(phone, code);
    if (inner.isDemo) await prefs.setBool('demo_signed_in', ok);
    return ok;
  }
  @override
  Future<void> signOut() async {
    await prefs.setBool('demo_signed_in', false);
    await inner.signOut();
  }
}
