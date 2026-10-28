import 'package:dukandost/data/repo.dart';
import 'package:dukandost/data/sync.dart';
import 'package:dukandost/services/bill.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeRemote implements Remote {
  final tables = <String, Map<String, Map<String, dynamic>>>{};
  @override
  Future<void> upsert(String table, List<Map<String, dynamic>> rows) async {
    for (final r in rows) {
      (tables[table] ??= {})[r['id'] as String] = {...r, if (table == 'shops') 'plan': 'pro', if (table == 'shops') 'trial_ends_at': '2026-12-01T00:00:00Z'};
    }
  }
  @override
  Future<List<Map<String, dynamic>>> pull(String table, String shopId, DateTime since) async =>
      (tables[table]?.values ?? const <Map<String, dynamic>>[]).where((r) => r['shop_id'] == shopId && DateTime.parse(r['updated_at']).isAfter(since)).toList();
  @override
  Future<Map<String, dynamic>?> shop(String shopId) async => tables['shops']?[shopId];
}

void main() {
  test('bill text and pdf', () async {
    final (db, r) = await seeded();
    await r.saveItem(name: 'Dalda Ghee 1kg', sellPrice: 560, buyPrice: 500, stock: 5);
    final item = (await r.watchItems().first).single;
    final c = await r.saveParty(kind: 'customer', name: 'Ahmed Raza');
    final s = await r.createSale(lines: [CartLine(item, 2)], method: 'udhaar', partyId: c, discount: 20);
    final b = BillData(shop: (await r.shop())!, sale: s, lines: await r.saleLines(s.id), customer: await r.party(c));
    final txt = billText(b);
    expect(txt, contains('Bismillah Kiryana Store'));
    expect(txt, contains('Dalda Ghee 1kg x2'));
    expect(txt, contains('Rs 1,100'));
    expect(txt, contains('AgriBridge ERP'));
    expect(txt.split('\n').every((l) => l.length <= 32), isTrue);
    final pdf = await billPdf(b);
    expect(String.fromCharCodes(pdf.take(4)), '%PDF');
    final esc = escPos(txt);
    expect(esc.take(2), [0x1B, 0x40]);
    await db.close();
  });

  test('sync pushes dirty rows, pulls server plan, and restores to a new device', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final remote = FakeRemote();
    final (db, r) = await seeded();
    await r.saveItem(name: 'Chai', sellPrice: 450, stock: 4);
    final item = (await r.watchItems().first).single;
    await r.createSale(lines: [CartLine(item)], method: 'cash');
    final res = await SyncService(db, remote, prefs).run();
    expect(res.pushed, greaterThanOrEqualTo(4)); // shop + item + sale + line
    expect(remote.tables['shops']!.values.single.containsKey('plan'), isTrue);
    expect(remote.tables['items']!.values.single['deleted'], false);
    expect((await r.shop())!.plan, 'pro'); // server decides plan
    final dirty = await db.customSelect('SELECT COUNT(*) c FROM items WHERE dirty = 1').getSingle();
    expect(dirty.read<int>('c'), 0);
    final second = await SyncService(db, remote, prefs).run();
    expect(second.pushed, 0);

    // new phone: same shop row, empty data -> pull everything
    final db2 = memDb();
    final shop = (await r.shop())!;
    await db2.into(db2.shops).insert(shop);
    SharedPreferences.setMockInitialValues({});
    final res2 = await SyncService(db2, remote, await SharedPreferences.getInstance()).run();
    expect(res2.pulled, greaterThanOrEqualTo(3));
    final items2 = await Repo(db2).watchItems().first;
    expect(items2.single.name, 'Chai');
    expect(items2.single.stock, 3);
    expect((await Repo(db2).summary(Period.today())).sales, 450);
    await db.close();
    await db2.close();
  });

  test('drift date round trip', () {
    final d = DateTime(2026, 10, 21, 10, 5);
    expect(parseDriftDate(driftDate(d)).isAtSameMomentAs(d), isTrue);
    expect(parseDriftDate('2026-10-21 05:56:05').isUtc, isTrue);
  });
}
