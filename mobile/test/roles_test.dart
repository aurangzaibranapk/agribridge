import 'package:agribridge/app/app.dart';
import 'package:agribridge/core/auth/session_controller.dart';
import 'package:agribridge/core/models/app_role.dart';
import 'package:agribridge/features/roles/role_data.dart';
import 'package:agribridge/features/roles/role_home.dart';
import 'package:agribridge/features/roles/role_prefs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<ProviderContainer> pumpAs(WidgetTester tester, AppRole role) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final c = ProviderContainer();
  addTearDown(c.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(container: c, child: const AgriBridgeApp()));
  await tester.pump();
  c.read(sessionProvider.notifier).useDemoRole(role);
  await tester.pumpAndSettle();
  return c;
}

void main() {
  group('role routing', () {
    test('whoami kind decides shell', () {
      expect(AppRoleX.fromWhoami('farmer', 'customer'), AppRole.farmer);
      expect(AppRoleX.fromWhoami('customer', null), AppRole.customer);
      expect(AppRoleX.fromWhoami('staff', 'sales_staff'), AppRole.staff);
      expect(AppRoleX.fromWhoami('staff', 'owner'), AppRole.admin);
      expect(AppRoleX.fromWhoami(null, 'farmer'), AppRole.farmer, reason: '605 not live -> profile role');
      expect(RoleHome.shellFor(AppRole.farmer), 'farmer');
      expect(RoleHome.shellFor(AppRole.customer), 'customer');
      expect(RoleHome.shellFor(AppRole.staff), 'staff');
      expect(RoleHome.shellFor(AppRole.admin), 'staff');
      expect(RoleHome.shellFor(AppRole.dealer), 'dealer');
    });
  });

  group('helpers', () {
    test('entry draft validation: amount needed, kinds fixed', () {
      StaffEntryDraft d(String k, double? a, [String p = 'x']) => StaffEntryDraft(clientUuid: 'u', kind: k, partyId: p, amount: a);
      expect(d('recovery', null).validate(), isNotNull);
      expect(d('recovery', 0).validate(), isNotNull);
      expect(d('recovery', 500).validate(), isNull);
      expect(d('visit_note', null).validate(), isNull);
      expect(d('udhaar_sale', 10).validate(), isNotNull, reason: 'no udhaar kind');
      expect(d('recovery', 10, '').validate(), isNotNull);
      expect(d('recovery', 10).toParams()['p_client_uuid'], 'u');
    });
    test('phone mask + whatsapp link', () {
      expect(maskPhone('0300-1234521'), '0300xxxxx21');
      expect(whatsappUri('03001234521', 'Salam').toString(), 'https://wa.me/923001234521?text=Salam');
    });
    test('demand categories are category-first incl karyana/other, no fertilizer credit', () {
      expect(DemandCategory.all.map((c) => c.code), ['karyana', 'fertilizer', 'pesticide', 'seed', 'wanda', 'other']);
    });
  });

  testWidgets('farmer home: tiles, KPIs, no fertilizer-credit / livestock', (t) async {
    await pumpAs(t, AppRole.farmer);
    expect(find.text('Kisan Dashboard'), findsOneWidget);
    expect(find.byKey(const ValueKey('tile-season')), findsOneWidget);
    expect(find.byKey(const ValueKey('kisan-ai')), findsOneWidget);
    expect(find.textContaining('Fertilizer Credit'), findsNothing);
    expect(find.textContaining('Livestock'), findsNothing);
    expect(find.byKey(const ValueKey('plus')), findsOneWidget);
  });

  testWidgets('farmer dairy has Doodh ki Farokht + Maweshi Loan', (t) async {
    await pumpAs(t, AppRole.farmer);
    await t.ensureVisible(find.byKey(const ValueKey('tile-dairy')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('tile-dairy')));
    await t.pumpAndSettle();
    expect(find.text('Dairy Management'), findsOneWidget);
    expect(find.byKey(const ValueKey('tile-milk-sale')), findsOneWidget);
    expect(find.byKey(const ValueKey('tile-animal-loan')), findsOneWidget);
    await t.ensureVisible(find.byKey(const ValueKey('tile-milk-sale')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('tile-milk-sale')));
    await t.pumpAndSettle();
    expect(find.text('Demo Milk Centre'), findsOneWidget);
  });

  testWidgets('product demand is category-first', (t) async {
    await pumpAs(t, AppRole.farmer);
    await t.ensureVisible(find.byKey(const ValueKey('tile-demand')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('tile-demand')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('demand-product')), findsNothing, reason: 'no form before category');
    await t.tap(find.byKey(const ValueKey('cat-fertilizer')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('demand-product')), findsOneWidget);
    expect(find.textContaining('unit: bori'), findsOneWidget);
    expect(find.text('Engro Urea'), findsOneWidget, reason: 'only fertilizer products suggested');
    expect(find.text('1718 Rice Seed'), findsNothing);
  });

  testWidgets('customer nav: Home, Khata, +, Orders, Profile', (t) async {
    await pumpAs(t, AppRole.customer);
    expect(find.text('Customer Portal'), findsOneWidget);
    for (final l in ['Home', 'Khata', 'Orders', 'Profile']) { expect(find.text(l), findsWidgets); }
    expect(find.text('Kheti'), findsNothing);
    expect(find.text('Dairy'), findsNothing);
    expect(find.byKey(const ValueKey('customer-khata-card')), findsOneWidget);
  });

  testWidgets('staff home -> parties -> party view; WhatsApp needs confirm', (t) async {
    await pumpAs(t, AppRole.staff);
    expect(find.text('AgriBridge Staff'), findsWidgets);
    expect(find.text('Aaj ki sale'), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('nav-parties')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('party-p-b')), findsOneWidget);
    expect(find.textContaining('0301xxxxx45'), findsOneWidget, reason: 'masked phone in list');
    await t.tap(find.byKey(const ValueKey('party-p-b')));
    await t.pumpAndSettle();
    expect(find.text('Demo Kisan B'), findsOneWidget);
    await t.ensureVisible(find.byKey(const ValueKey('party-wa')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('party-wa')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('wa-confirm')), findsOneWidget);
    await t.tap(find.text('Cancel'));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('wa-confirm')), findsNothing);
  });

  testWidgets('staff add entry -> pending only, same sheet not duplicated', (t) async {
    final c = await pumpAs(t, AppRole.staff);
    await t.tap(find.byKey(const ValueKey('plus')));
    await t.pumpAndSettle();
    expect(find.textContaining('PENDING'), findsWidgets);
    await t.tap(find.byKey(const ValueKey('entry-party')));
    await t.pumpAndSettle();
    await t.tap(find.textContaining('Demo Kisan B').last);
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const ValueKey('entry-amount')), '10000');
    await t.tap(find.byKey(const ValueKey('entry-save')));
    await t.pumpAndSettle();
    final entries = c.read(demoEntriesProvider);
    expect(entries.first['status'], 'pending');
    expect(entries.first['amount'], 10000);
    expect(entries.where((e) => e['status'] == 'pending').length, 1);
  });

  testWidgets('Urdu switches to RTL; navy-dark theme toggles', (t) async {
    final c = await pumpAs(t, AppRole.farmer);
    await t.tap(find.byKey(const ValueKey('lang-ur')).first);
    await t.pumpAndSettle();
    expect(c.read(appLangProvider), AppLang.ur);
    expect(find.text('کسان ڈیش بورڈ'), findsOneWidget);
    final dir = Directionality.of(t.element(find.text('کسان ڈیش بورڈ')));
    expect(dir, TextDirection.rtl);
    c.read(navyDarkProvider.notifier).state = true;
    await t.pumpAndSettle();
    expect(Theme.of(t.element(find.text('کسان ڈیش بورڈ'))).brightness, Brightness.dark);
  });

  testWidgets('demo role switch in app bar', (t) async {
    final c = await pumpAs(t, AppRole.farmer);
    await t.tap(find.byKey(const ValueKey('demo-role-switch')).first);
    await t.pumpAndSettle();
    await t.tap(find.text('Demo: Sales staff'));
    await t.pumpAndSettle();
    expect(c.read(sessionProvider).valueOrNull?.role, AppRole.staff);
    expect(find.text('Aaj ki sale'), findsOneWidget);
  });
}
