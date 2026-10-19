import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';

import '../config/app_config.dart';
import '../data/mobile_repository.dart';

class PushService {
  PushService._();
  static StreamSubscription<String>? _refreshSubscription;

  static Future<void> syncForSignedInUser() async {
    if (!AppConfig.firebaseMessagingEnabled || !AppConfig.hasSupabase) return;
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    final token = await messaging.getToken();
    if (token != null) await _register(token);
    _refreshSubscription ??= messaging.onTokenRefresh.listen(_register);
  }

  static Future<void> _register(String token) {
    return MobileRepository().registerDevice(
      token: token,
      platform: Platform.isAndroid ? 'android' : Platform.isIOS ? 'ios' : 'web',
    );
  }
}
