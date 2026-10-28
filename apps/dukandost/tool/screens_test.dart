// Renders real app screens to PNG for side-by-side review with the mockups.
// Run: flutter test --update-goldens tool/screens_test.dart
import 'dart:io';

import 'package:dukandost/app/app.dart';
import 'package:dukandost/app/providers.dart';
import 'package:dukandost/data/repo.dart';
import 'package:dukandost/services/auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../test/helpers.dart';

Future<void> loadFonts() async {
  final mf = '${Platform.environment['FLUTTER_ROOT'] ?? '/home/box/sdk/flutter'}/bin/cache/artifacts/material_fonts';
  Future<void> fam(String name, List<String> files) async {
    final l = FontLoader(name);
    for (final f in files) {
      l.addFont(Future.value(ByteData.sublistView(File(f).readAsBytesSync())));
    }
    await l.load();
  }
  await fam('Roboto', ['$mf/Roboto-Regular.ttf', '$mf/Roboto-Medium.ttf', '$mf/Roboto-Bold.ttf', '$mf/Roboto-Black.ttf']);
  await fam('MaterialIcons', ['$mf/MaterialIcons-Regular.otf']);
  await fam('Noto Color Emoji', ['/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf']);
  final ar = Directory('/usr/share/fonts/truetype/sand-box/google/Noto Sans Arabic').listSync().whereType<File>().map((f) => f.path).toList();
  await fam('Noto Sans Arabic', ar);
}

Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 6; i++) {
    await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
    await t.pump(const Duration(milliseconds: 50));
  }
}

late String saleId, partyId;

Future<void> seed(Repo r) async {
  await r.createShop(name: 'Bismillah Kiryana Store', phone: '0300-1234567', address: 'Main Bazar, Okara');
  final now = DateTime.now();
  final ids = <String>[];
  for (final (n, c, b, s, st, lo, bc) in [
    ('Dalda Ghee 1kg', 'Ghee/Tel', 520.0, 560.0, 3.0, 5.0, '111'),
    ('Super Basmati 5kg', 'Chawal', 1750.0, 1850.0, 24.0, 5.0, '222'),
    ('Coca-Cola 1.5L', 'Drinks', 165.0, 210.0, 60.0, 10.0, '333'),
    ('Lipton Chai 190g', 'Chai', 410.0, 450.0, 5.0, 6.0, '444'),
    ('Surf Excel 1kg', 'Masalay', 680.0, 750.0, 18.0, 5.0, '555'),
    ('Shan Biryani', 'Masalay', 85.0, 110.0, 42.0, 10.0, '666'),
  ]) {
    ids.add(await r.saveItem(name: n, category: c, buyPrice: b, sellPrice: s, stock: st + 20, lowStockAt: lo, barcode: bc));
  }
  final items = await r.watchItems().first;
  Item(String n) => items.firstWhere((i) => i.name == n);
  final ahmed = await r.saveParty(kind: 'customer', name: 'Ahmed Raza', phone: '0301-7654321', creditLimit: 25000);
  partyId = ahmed;
  final bilal = await r.saveParty(kind: 'customer', name: 'Bilal Hussain', phone: '0333-1112223');
  final shazia = await r.saveParty(kind: 'customer', name: 'Shazia Bibi', phone: '0345-5556667');
  final usman = await r.saveParty(kind: 'supplier', name: 'Usman Traders', phone: '0300-9998887');
  for (var d = 6; d >= 0; d--) {
    final at = now.subtract(Duration(days: d, hours: 1));
    await r.createSale(lines: [CartLine(Item('Super Basmati 5kg'), 1 + d % 3), CartLine(Item('Coca-Cola 1.5L'), 3)], method: d.isEven ? 'cash' : 'jazzcash', at: at);
  }
  await r.addLedger(ahmed, 7500, note: 'Bill #S-0987', refType: 'sale', at: now.subtract(const Duration(days: 9)));
  await r.addLedger(ahmed, -3000, method: 'cash', at: now.subtract(const Duration(days: 8)));
  await r.addLedger(ahmed, -5000, method: 'jazzcash', at: now.subtract(const Duration(days: 3)));
  final s = await r.createSale(lines: [CartLine(Item('Dalda Ghee 1kg'), 2), CartLine(Item('Super Basmati 5kg')), CartLine(Item('Coca-Cola 1.5L'), 3), CartLine(Item('Lipton Chai 190g'))],
      method: 'udhaar', discount: 50, partyId: ahmed);
  saleId = s.id;
  await r.setPromise(ahmed, now.add(const Duration(days: 4)));
  await r.addLedger(bilal, 12200, note: 'Bill #S-1001', refType: 'sale', at: now.subtract(const Duration(days: 12)));
  await r.addLedger(shazia, 5750, note: 'Bill #S-1010', refType: 'sale', at: now.subtract(const Duration(days: 2)));
  await r.createPurchase(partyId: usman, refNo: 'UT-5531', lines: [CartLine(Item('Dalda Ghee 1kg'), 40), CartLine(Item('Lipton Chai 190g'), 24)], paid: 20000);
  for (final (c, a) in [('Tankhwah', 30000.0), ('Kiraya', 15000.0), ('Bijli/Gas', 9800.0), ('Chai/Khana', 1600.0)]) {
    await r.addExpense(category: c, amount: a);
  }
  // keep two items low for the alert card
  await r.saveItem(id: ids[0], name: 'Dalda Ghee 1kg', category: 'Ghee/Tel', buyPrice: 520, sellPrice: 560, stock: 3, lowStockAt: 5, barcode: '111');
  await r.saveItem(id: ids[3], name: 'Lipton Chai 190g', category: 'Chai', buyPrice: 410, sellPrice: 450, stock: 5, lowStockAt: 6, barcode: '444');
}

Future<void> shot(WidgetTester t, String name, String route, {bool signedIn = true, Future<void> Function(WidgetTester)? act}) async {
  t.view.physicalSize = const Size(390 * 2, 844 * 2);
  t.view.devicePixelRatio = 2;
  SharedPreferences.setMockInitialValues({'lang': 'roman'});
  final prefs = await SharedPreferences.getInstance();
  final db = memDb();
  if (signedIn) await t.runAsync(() => seed(Repo(db)));
  final r = route.replaceAll('{sale}', signedIn ? saleId : '').replaceAll('{party}', signedIn ? partyId : '');
  await t.pumpWidget(ProviderScope(overrides: [
    dbProvider.overrideWithValue(db),
    prefsProvider.overrideWithValue(prefs),
    authProvider.overrideWithValue(DemoAuthService(signedIn: signedIn)),
    initialRouteProvider.overrideWithValue(r),
  ], child: const DukanDostApp()));
  await settle(t);
  if (act != null) {
    await act(t);
    await settle(t);
  }
  await t.runAsync(() async {
    for (final e in find.byType(Image).evaluate()) {
      await precacheImage((e.widget as Image).image, e);
    }
  });
  await expectLater(find.byType(DukanDostApp), matchesGoldenFile('../built/$name.png'));
  await t.pumpWidget(const SizedBox());
  final f = db.close();
  for (var i = 0; i < 5; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
  await f;
  t.view.reset();
}

void main() {
  setUpAll(loadFonts);
  Future<void> scan(WidgetTester t, String code) async {
    await t.enterText(find.byKey(const Key('posSearch')), code);
    await t.testTextInput.receiveAction(TextInputAction.done);
    await settle(t);
  }
  testWidgets('01', (t) => shot(t, '01-splash-login', '/login', signedIn: false));
  testWidgets('02', (t) => shot(t, '02-dashboard', '/'));
  testWidgets('03', (t) => shot(t, '03-new-sale-pos', '/sale', act: (t) async {
        for (final c in ['111', '111', '222', '333', '333', '333', '444']) {
          await scan(t, c);
        }
      }));
  testWidgets('04', (t) => shot(t, '04-bill-share', '/bill/{sale}'));
  testWidgets('05', (t) => shot(t, '05-khata-list', '/?tab=1'));
  testWidgets('06', (t) => shot(t, '06-party-khata', '/party/{party}'));
  testWidgets('07', (t) => shot(t, '07-stock-list', '/?tab=2'));
  testWidgets('08', (t) => shot(t, '08-add-purchase', '/purchase'));
  testWidgets('09', (t) => shot(t, '09-expenses', '/expenses'));
  testWidgets('10', (t) => shot(t, '10-reports', '/?tab=3'));
  testWidgets('11', (t) => shot(t, '11-settings', '/settings'));
}
