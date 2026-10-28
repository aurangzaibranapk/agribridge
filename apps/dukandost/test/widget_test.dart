import 'package:dukandost/app/app.dart';
import 'package:dukandost/app/providers.dart';
import 'package:dukandost/data/db.dart';
import 'package:dukandost/data/repo.dart';
import 'package:dukandost/services/auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 6; i++) {
    await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
    await t.pump(const Duration(milliseconds: 50));
  }
}

Future<AppDb> pumpApp(WidgetTester t, {bool signedIn = true, bool withShop = true, String lang = 'roman', String initial = '/', Future<void> Function(Repo r)? seed}) async {
  t.view.physicalSize = const Size(390 * 3, 844 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  SharedPreferences.setMockInitialValues({'lang': lang});
  final prefs = await SharedPreferences.getInstance();
  final db = memDb();
  if (withShop) {
    await t.runAsync(() async {
      final r = Repo(db);
      await r.createShop(name: 'Bismillah Kiryana Store', phone: '03001234567');
      await r.saveItem(name: 'Dalda Ghee 1kg', category: 'Ghee/Tel', buyPrice: 520, sellPrice: 560, stock: 3, lowStockAt: 5, barcode: '111');
      await r.saveItem(name: 'Lipton Chai 190g', category: 'Chai', buyPrice: 410, sellPrice: 450, stock: 20, lowStockAt: 5);
      if (seed != null) await seed(r);
    });
  }
  await t.pumpWidget(ProviderScope(overrides: [
    dbProvider.overrideWithValue(db),
    prefsProvider.overrideWithValue(prefs),
    authProvider.overrideWithValue(DemoAuthService(signedIn: signedIn)),
    initialRouteProvider.overrideWithValue(initial),
  ], child: const DukanDostApp()));
  await settle(t);
  return db;
}

Future<void> done(WidgetTester t, AppDb db) async {
  await t.pumpWidget(const SizedBox());
  final f = db.close();
  for (var i = 0; i < 5; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
  await f;
}

void main() {
  testWidgets('login with demo OTP then shop setup lands on dashboard', (t) async {
    final db = await pumpApp(t, signedIn: false, withShop: false);
    expect(find.text('DukanDost'), findsOneWidget);
    expect(find.textContaining('AgriBridge ERP'), findsWidgets);
    await t.enterText(find.byKey(const Key('phone')), '03001234567');
    await t.tap(find.text('OTP bhejein'));
    await settle(t);
    await t.enterText(find.byKey(const Key('otp')), '123456');
    await t.tap(find.text('Tasdeeq karein'));
    await settle(t);
    expect(find.text('Dukaan ki maloomat'), findsOneWidget);
    await t.enterText(find.byKey(const Key('shopName')), 'Madina Store');
    await t.tap(find.text('Shuru karein'));
    await settle(t);
    expect(find.text('Madina Store'), findsOneWidget);
    expect(find.text('Aaj ki sale'), findsOneWidget);
    await done(t, db);
  });

  testWidgets('language switch to Urdu is RTL', (t) async {
    final db = await pumpApp(t, signedIn: false, withShop: false);
    await t.tap(find.text('اردو'));
    await settle(t);
    expect(find.text('او ٹی پی بھیجیں'), findsOneWidget);
    expect(Directionality.of(t.element(find.text('او ٹی پی بھیجیں'))), TextDirection.rtl);
    await done(t, db);
  });

  testWidgets('dashboard shows low stock alert', (t) async {
    final db = await pumpApp(t);
    expect(find.text('Bismillah Kiryana Store'), findsOneWidget);
    expect(find.text('3 baqi'), findsOneWidget);
    await done(t, db);
  });

  testWidgets('POS: barcode entry adds item, cash bill is created', (t) async {
    final db = await pumpApp(t, initial: '/sale');
    await t.enterText(find.byKey(const Key('posSearch')), '111');
    await t.testTextInput.receiveAction(TextInputAction.done);
    await settle(t);
    expect(find.byKey(const Key('posTotal')), findsOneWidget);
    expect((t.widget<Text>(find.byKey(const Key('posTotal')))).data, 'Rs 560');
    await t.tap(find.byKey(const Key('checkout')));
    await settle(t);
    expect(find.textContaining('Bill ban gaya'), findsOneWidget);
    final txt = t.widget<Text>(find.byKey(const Key('billText'))).data!;
    expect(txt, contains('Dalda Ghee 1kg x1'));
    final items = await t.runAsync(() => Repo(db).watchItems().first);
    expect(items!.firstWhere((i) => i.name.startsWith('Dalda')).stock, 2);
    await done(t, db);
  });

  testWidgets('POS: udhaar without customer is blocked', (t) async {
    final db = await pumpApp(t, initial: '/sale');
    await t.enterText(find.byKey(const Key('posSearch')), '111');
    await t.testTextInput.receiveAction(TextInputAction.done);
    await settle(t);
    await t.tap(find.textContaining('Udhaar'));
    await t.pump();
    await t.tap(find.byKey(const Key('checkout')));
    await settle(t);
    expect(find.text('Udhaar ke liye customer chunein'), findsOneWidget);
    await done(t, db);
  });

  testWidgets('khata: balance after udhaar and payment', (t) async {
    final db = await pumpApp(t, seed: (r) async {
      final id = await r.saveParty(kind: 'customer', name: 'Ahmed Raza', phone: '03017654321', creditLimit: 25000);
      await r.addLedger(id, 4000, note: 'Bill #S-1');
      await r.addLedger(id, -1500, method: 'cash');
    });
    await t.tap(find.byKey(const Key('nav1')));
    await settle(t);
    expect(find.text('Ahmed Raza'), findsOneWidget);
    expect(find.text('Rs 2,500'), findsWidgets);
    await t.tap(find.text('Ahmed Raza'));
    await settle(t);
    expect(t.widget<Text>(find.byKey(const Key('partyBalance'))).data, 'Rs 2,500');
    expect(find.byKey(const Key('remind')), findsOneWidget);
    await done(t, db);
  });

  testWidgets('stock tab, reports and settings render', (t) async {
    final db = await pumpApp(t);
    await t.tap(find.byKey(const Key('nav2')));
    await settle(t);
    expect(find.text('Lipton Chai 190g'), findsOneWidget);
    await t.tap(find.byKey(const Key('nav3')));
    await settle(t);
    expect(find.textContaining('Zyada bikne wale'), findsOneWidget);
    await t.tap(find.byKey(const Key('nav0')));
    await settle(t);
    await t.tap(find.byKey(const Key('settings')));
    await settle(t);
    expect(find.text('Pro plan'), findsOneWidget);
    expect(find.textContaining('trial baqi'), findsWidgets);
    await done(t, db);
  });
}
