import 'package:dukandost/data/repo.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  test('cash sale lowers stock, numbers bills and counts profit', () async {
    final (db, r) = await seeded();
    final id = await r.saveItem(name: 'Dalda', buyPrice: 500, sellPrice: 560, stock: 10, lowStockAt: 3);
    final item = (await r.watchItems().first).firstWhere((i) => i.id == id);
    final s1 = await r.createSale(lines: [CartLine(item, 2)], method: 'cash', discount: 20);
    final s2 = await r.createSale(lines: [CartLine(item, 1)], method: 'jazzcash');
    expect(s1.billNo, 1);
    expect(s2.billNo, 2);
    expect(s1.total, 1100);
    expect((await r.watchItems().first).single.stock, 7);
    final sum = await r.summary(Period.today());
    expect(sum.sales, 1660);
    expect(sum.cost, 1500);
    expect(sum.count, 2);
    final acc = await r.accounts();
    expect(acc['cash'], 1100);
    expect(acc['wallet'], 560);
    await db.close();
  });

  test('udhaar sale needs customer and posts to khata; payment reduces it', () async {
    final (db, r) = await seeded();
    final id = await r.saveItem(name: 'Chai', sellPrice: 450, buyPrice: 400, stock: 5);
    final item = (await r.watchItems().first).single;
    expect(() => r.createSale(lines: [CartLine(item)], method: 'udhaar'), throwsArgumentError);
    final c = await r.saveParty(kind: 'customer', name: 'Ahmed Raza', phone: '03017654321');
    await r.createSale(lines: [CartLine(item, 2)], method: 'udhaar', partyId: c);
    expect(await r.balanceOf(c), 900);
    await r.addLedger(c, -500, method: 'easypaisa');
    expect(await r.balanceOf(c), 400);
    expect(await r.totalBalance('customer'), 400);
    expect((await r.accounts())['wallet'], 500);
    final b = await r.watchBalances('customer').first;
    expect(b.single.balance, 400);
    expect(id, isNotEmpty);
    await db.close();
  });

  test('purchase raises stock and supplier payable; low stock + expenses', () async {
    final (db, r) = await seeded();
    await r.saveItem(name: 'Ghee', buyPrice: 500, sellPrice: 560, stock: 2, lowStockAt: 3);
    expect((await r.watchLowStock().first).length, 1);
    final item = (await r.watchItems().first).single;
    final sup = await r.saveParty(kind: 'supplier', name: 'Usman Traders');
    await r.createPurchase(partyId: sup, lines: [CartLine(item.copyWith(buyPrice: 520), 10)], paid: 2000);
    final after = (await r.watchItems().first).single;
    expect(after.stock, 12);
    expect(after.buyPrice, 520);
    expect(await r.totalBalance('supplier'), 3200);
    expect(await r.watchLowStock().first, isEmpty);
    await r.addExpense(category: 'Kiraya', amount: 15000);
    final s = await r.summary(Period.of('month'));
    expect(s.expenses, 15000);
    expect((await r.accounts())['cash'], -17000);
    expect(await r.stockValue(), 12 * 520);
    await db.close();
  });

  test('periods and daily series', () async {
    final (db, r) = await seeded();
    final item = (await r.watchItems().first).firstOrNull ??
        (await r.saveItem(name: 'X', sellPrice: 100).then((_) => r.watchItems().first)).single;
    final now = DateTime(2026, 10, 21, 12);
    await r.createSale(lines: [CartLine(item)], method: 'cash', at: now.subtract(const Duration(days: 2)));
    await r.createSale(lines: [CartLine(item, 3)], method: 'cash', at: now);
    final w = await r.dailySales(Period.of('week', now));
    expect(w.length, 7);
    expect(w.last, 300);
    expect(w[4], 100);
    expect((await r.topItems(Period.of('week', now))).single.$3, 400);
    await db.close();
  });

  test('sample items seed', () async {
    final (db, r) = await seeded();
    await r.seedSampleItems();
    expect(await r.itemCount(), 5);
    await db.close();
  });
}
