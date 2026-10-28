import 'package:dukandost/core/i18n.dart';
import 'package:dukandost/core/money.dart';
import 'package:dukandost/core/plan.dart';
import 'package:dukandost/services/auth.dart';
import 'package:dukandost/services/whatsapp.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Pakistani money format', () {
    expect(rs(126400), 'Rs 1,26,400');
    expect(rs(48250), 'Rs 48,250');
    expect(rs(-50), '-Rs 50');
    expect(rsShort(6800000), 'Rs 68L');
  });

  test('every string has roman, english and urdu', () {
    for (final e in allStrings) {
      expect(e.value.length, 3, reason: e.key);
      expect(e.value.every((s) => s.isNotEmpty), isTrue, reason: e.key);
    }
    expect(tr(Lang.ur, 'send_otp'), 'او ٹی پی بھیجیں');
    expect(tr(Lang.roman, 'send_otp'), 'OTP bhejein');
    expect(dirOf(Lang.ur), TextDirection.rtl);
    expect(tr(Lang.en, 'reminder_msg', {'name': 'Ali', 'shop': 'S', 'amount': 'Rs 5'}), contains('Ali'));
  });

  test('plan: 14-day trial then free with item limit', () {
    final start = DateTime(2026, 10, 1);
    final ends = start.add(const Duration(days: 14));
    final t = PlanStatus('trial', ends, start);
    expect(t.inTrial, isTrue);
    expect(t.trialDaysLeft, 14);
    expect(t.allows(Feature.reports), isTrue);
    final later = PlanStatus('trial', ends, start.add(const Duration(days: 15)));
    expect(later.effective, 'free');
    expect(later.allows(Feature.whatsappReminders), isFalse);
    expect(later.canAddItem(99), isTrue);
    expect(later.canAddItem(100), isFalse);
    expect(PlanStatus('pro', ends, start.add(const Duration(days: 99))).hasPro, isTrue);
  });

  test('phone helpers', () {
    expect(e164Pk('0300 1234567'), '+923001234567');
    expect(validPkMobile('03001234567'), isTrue);
    expect(validPkMobile('12345'), isFalse);
    expect(normalizePkPhone('0301-7654321'), '923017654321');
    final u = whatsappUri('03017654321', 'Baqi Rs 400');
    expect(u.toString(), 'https://wa.me/923017654321?text=Baqi%20Rs%20400');
  });

  test('demo auth', () async {
    final a = DemoAuthService();
    expect(await a.verify('0300', '000000'), isFalse);
    expect(await a.verify('0300', '123456'), isTrue);
    expect(a.signedIn, isTrue);
  });
}
