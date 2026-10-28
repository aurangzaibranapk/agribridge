import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import 'db.dart';

const _uuid = Uuid();
String newId() => _uuid.v4();

/// Payment methods supported by POS.
const payMethods = ['cash', 'jazzcash', 'easypaisa', 'bank', 'udhaar'];

/// Money "account" a method lands in for the cash-flow card.
String accountOf(String? method) => switch (method) {
      'bank' => 'bank',
      'jazzcash' || 'easypaisa' => 'wallet',
      _ => 'cash',
    };

class CartLine {
  CartLine(this.item, [this.qty = 1]);
  final Item item;
  double qty;
  double get amount => item.sellPrice * qty;
}

class PartyBalance {
  PartyBalance(this.party, this.balance, this.lastAt);
  final Party party;
  final double balance;
  final DateTime? lastAt;
  int get ageDays => lastAt == null ? 0 : DateTime.now().difference(lastAt!).inDays;
}

class Period {
  Period(this.from, this.to);
  final DateTime from, to;
  static Period today([DateTime? now]) {
    final n = now ?? DateTime.now();
    final d = DateTime(n.year, n.month, n.day);
    return Period(d, d.add(const Duration(days: 1)));
  }

  static Period of(String key, [DateTime? now]) {
    final n = now ?? DateTime.now();
    final t = DateTime(n.year, n.month, n.day);
    return switch (key) {
      'week' => Period(t.subtract(const Duration(days: 6)), t.add(const Duration(days: 1))),
      'month' => Period(DateTime(n.year, n.month), DateTime(n.year, n.month + 1)),
      'year' => Period(DateTime(n.year), DateTime(n.year + 1)),
      _ => today(n),
    };
  }
}

class Summary {
  Summary({required this.sales, required this.cost, required this.expenses, required this.count});
  final double sales, cost, expenses;
  final int count;
  double get grossProfit => sales - cost;
  double get netProfit => sales - cost - expenses;
  double get margin => sales == 0 ? 0 : grossProfit / sales * 100;
}

class Repo {
  Repo(this.db);
  final AppDb db;

  // ---------- shop ----------
  Future<Shop?> shop() => db.select(db.shops).getSingleOrNull();
  Stream<Shop?> watchShop() => db.select(db.shops).watchSingleOrNull();

  Future<Shop> createShop({required String name, String? ownerName, String? phone, String? address,
      String? businessType, String lang = 'ur', DateTime? now}) async {
    final id = newId();
    await db.into(db.shops).insert(ShopsCompanion.insert(
          id: id, name: name, ownerName: Value(ownerName), phone: Value(phone),
          address: Value(address), businessType: Value(businessType), lang: Value(lang),
          trialEndsAt: (now ?? DateTime.now()).add(const Duration(days: 14)),
        ));
    return (await shop())!;
  }

  Future<void> updateShop(ShopsCompanion c) async {
    final s = await shop();
    if (s == null) return;
    await (db.update(db.shops)..where((t) => t.id.equals(s.id)))
        .write(c.copyWith(dirty: const Value(true), updatedAt: Value(DateTime.now())));
  }

  Future<String> _shopId() async => (await shop())!.id;

  // ---------- items ----------
  Stream<List<Item>> watchItems() => (db.select(db.items)
        ..where((t) => t.deleted.equals(false))
        ..orderBy([(t) => OrderingTerm(expression: t.name)]))
      .watch();

  Stream<List<Item>> watchLowStock() => (db.select(db.items)
        ..where((t) => t.deleted.equals(false) & t.stock.isSmallerOrEqual(t.lowStockAt) & t.lowStockAt.isBiggerThanValue(0))
        ..orderBy([(t) => OrderingTerm(expression: t.stock)]))
      .watch();

  Future<int> itemCount() async => (await (db.select(db.items)..where((t) => t.deleted.equals(false))).get()).length;

  Future<Item?> itemByBarcode(String code) =>
      (db.select(db.items)..where((t) => t.barcode.equals(code) & t.deleted.equals(false))).getSingleOrNull();

  Future<String> saveItem({String? id, required String name, String? barcode, String? category, String unit = 'pcs',
      double buyPrice = 0, double sellPrice = 0, double stock = 0, double lowStockAt = 0}) async {
    final sid = await _shopId();
    final iid = id ?? newId();
    await db.into(db.items).insertOnConflictUpdate(ItemsCompanion.insert(
          id: iid, shopId: sid, name: name, barcode: Value(barcode?.isEmpty == true ? null : barcode),
          category: Value(category), unit: Value(unit), buyPrice: Value(buyPrice), sellPrice: Value(sellPrice),
          stock: Value(stock), lowStockAt: Value(lowStockAt), updatedAt: Value(DateTime.now()), dirty: const Value(true),
        ));
    return iid;
  }

  Future<void> _adjustStock(String itemId, double delta) => db.customUpdate(
        'UPDATE items SET stock = stock + ?, dirty = 1, updated_at = ? WHERE id = ?',
        variables: [Variable.withReal(delta), Variable<DateTime>(DateTime.now()), Variable.withString(itemId)],
        updates: {db.items},
      );

  // ---------- parties ----------
  Stream<List<Party>> watchParties(String kind) => (db.select(db.parties)
        ..where((t) => t.kind.equals(kind) & t.deleted.equals(false))
        ..orderBy([(t) => OrderingTerm(expression: t.name)]))
      .watch();

  Future<Party?> party(String id) => (db.select(db.parties)..where((t) => t.id.equals(id))).getSingleOrNull();

  Future<String> saveParty({String? id, required String kind, required String name, String? phone,
      double? creditLimit, DateTime? promiseDate}) async {
    final sid = await _shopId();
    final pid = id ?? newId();
    await db.into(db.parties).insertOnConflictUpdate(PartiesCompanion.insert(
          id: pid, shopId: sid, kind: kind, name: name, phone: Value(phone), creditLimit: Value(creditLimit),
          promiseDate: Value(promiseDate), updatedAt: Value(DateTime.now()), dirty: const Value(true),
        ));
    return pid;
  }

  Future<void> setPromise(String partyId, DateTime? date) =>
      (db.update(db.parties)..where((t) => t.id.equals(partyId))).write(
          PartiesCompanion(promiseDate: Value(date), dirty: const Value(true), updatedAt: Value(DateTime.now())));

  Stream<List<PartyBalance>> watchBalances(String kind) {
    final q = db.customSelect(
      'SELECT p.id AS pid, COALESCE(SUM(l.amount),0) AS bal, MAX(l.created_at) AS last_at '
      'FROM parties p LEFT JOIN ledger l ON l.party_id = p.id AND l.deleted = 0 '
      'WHERE p.kind = ? AND p.deleted = 0 GROUP BY p.id',
      variables: [Variable.withString(kind)],
      readsFrom: {db.parties, db.ledger},
    ).watch();
    return q.asyncMap((rows) async {
      final parties = {for (final p in await (db.select(db.parties)..where((t) => t.kind.equals(kind))).get()) p.id: p};
      final out = <PartyBalance>[];
      for (final r in rows) {
        final p = parties[r.read<String>('pid')];
        if (p == null) continue;
        final last = r.readNullable<String>('last_at');
        out.add(PartyBalance(p, r.read<double>('bal'), last == null ? null : DateTime.parse(last)));
      }
      out.sort((a, b) => b.balance.compareTo(a.balance));
      return out;
    });
  }

  Stream<List<LedgerData>> watchLedger(String partyId) => (db.select(db.ledger)
        ..where((t) => t.partyId.equals(partyId) & t.deleted.equals(false))
        ..orderBy([(t) => OrderingTerm(expression: t.createdAt, mode: OrderingMode.desc)]))
      .watch();

  Future<double> balanceOf(String partyId) async {
    final r = await db.customSelect('SELECT COALESCE(SUM(amount),0) AS b FROM ledger WHERE party_id = ? AND deleted = 0',
        variables: [Variable.withString(partyId)]).getSingle();
    return r.read<double>('b');
  }

  /// [amount] > 0: udhaar diya / maal liya; < 0: paisay mile / diye.
  Future<void> addLedger(String partyId, double amount, {String? note, String? method, String? refType, String? refId, DateTime? at}) async {
    final sid = await _shopId();
    await db.into(db.ledger).insert(LedgerCompanion.insert(
          id: newId(), shopId: sid, partyId: partyId, amount: amount, note: Value(note), method: Value(method),
          refType: Value(refType), refId: Value(refId), createdAt: Value(at ?? DateTime.now()),
        ));
  }

  // ---------- sales ----------
  Future<Sale> createSale({required List<CartLine> lines, required String method, double discount = 0,
      String? partyId, double? paid, DateTime? at}) async {
    if (lines.isEmpty) throw ArgumentError('empty cart');
    if (method == 'udhaar' && partyId == null) throw ArgumentError('udhaar needs a customer');
    return db.transaction(() async {
      final s = (await shop())!;
      final subtotal = lines.fold<double>(0, (a, l) => a + l.amount);
      final total = (subtotal - discount).clamp(0, double.infinity).toDouble();
      final paidAmt = method == 'udhaar' ? (paid ?? 0) : total;
      final id = newId();
      final now = at ?? DateTime.now();
      await db.into(db.sales).insert(SalesCompanion.insert(
            id: id, shopId: s.id, billNo: s.nextBillNo, partyId: Value(partyId), subtotal: subtotal,
            discount: Value(discount), total: total, paid: Value(paidAmt), method: method, createdAt: Value(now),
          ));
      for (final l in lines) {
        await db.into(db.saleLines).insert(SaleLinesCompanion.insert(
              id: newId(), shopId: s.id, saleId: id, itemId: Value(l.item.id), name: l.item.name,
              qty: l.qty, price: l.item.sellPrice, cost: Value(l.item.buyPrice),
            ));
        await _adjustStock(l.item.id, -l.qty);
      }
      if (total - paidAmt > 0 && partyId != null) {
        await addLedger(partyId, total - paidAmt, note: 'Bill #${s.nextBillNo}', refType: 'sale', refId: id, at: now);
      }
      await (db.update(db.shops)..where((t) => t.id.equals(s.id)))
          .write(ShopsCompanion(nextBillNo: Value(s.nextBillNo + 1), dirty: const Value(true)));
      return (await (db.select(db.sales)..where((t) => t.id.equals(id))).getSingle());
    });
  }

  Future<Sale?> sale(String id) => (db.select(db.sales)..where((t) => t.id.equals(id))).getSingleOrNull();
  Future<List<SaleLine>> saleLines(String saleId) =>
      (db.select(db.saleLines)..where((t) => t.saleId.equals(saleId))).get();

  // ---------- purchases ----------
  Future<String> createPurchase({required String? partyId, String? refNo, required List<CartLine> lines,
      required double paid, String method = 'cash', DateTime? at}) async {
    return db.transaction(() async {
      final sid = await _shopId();
      final id = newId();
      final total = lines.fold<double>(0, (a, l) => a + l.item.buyPrice * l.qty);
      final now = at ?? DateTime.now();
      await db.into(db.purchases).insert(PurchasesCompanion.insert(
            id: id, shopId: sid, partyId: Value(partyId), refNo: Value(refNo), total: total,
            paid: Value(paid), method: Value(method), createdAt: Value(now),
          ));
      for (final l in lines) {
        await db.into(db.purchaseLines).insert(PurchaseLinesCompanion.insert(
              id: newId(), shopId: sid, purchaseId: id, itemId: Value(l.item.id), name: l.item.name,
              qty: l.qty, price: l.item.buyPrice,
            ));
        await _adjustStock(l.item.id, l.qty);
        await (db.update(db.items)..where((t) => t.id.equals(l.item.id))).write(ItemsCompanion(
            buyPrice: Value(l.item.buyPrice), dirty: const Value(true), updatedAt: Value(DateTime.now())));
      }
      if (partyId != null && total - paid > 0) {
        await addLedger(partyId, total - paid, note: 'Purchase ${refNo ?? ''}'.trim(), refType: 'purchase', refId: id, at: now);
      }
      return id;
    });
  }

  // ---------- expenses ----------
  Future<void> addExpense({required String category, required double amount, String? note, String method = 'cash', DateTime? at}) async {
    final sid = await _shopId();
    await db.into(db.expenses).insert(ExpensesCompanion.insert(
        id: newId(), shopId: sid, category: category, amount: amount, note: Value(note), method: Value(method),
        createdAt: Value(at ?? DateTime.now())));
  }

  Stream<List<Expense>> watchExpenses(Period p) => (db.select(db.expenses)
        ..where((t) => t.deleted.equals(false) & t.createdAt.isBetweenValues(p.from, p.to))
        ..orderBy([(t) => OrderingTerm(expression: t.createdAt, mode: OrderingMode.desc)]))
      .watch();

  // ---------- reports ----------
  Future<Summary> summary(Period p) async {
    final v = [Variable<DateTime>(p.from), Variable<DateTime>(p.to)];
    final s = await db.customSelect(
        'SELECT COALESCE(SUM(total),0) t, COUNT(*) c FROM sales WHERE deleted=0 AND created_at >= ? AND created_at < ?',
        variables: v).getSingle();
    final c = await db.customSelect(
        'SELECT COALESCE(SUM(l.cost*l.qty),0) c FROM sale_lines l JOIN sales s ON s.id=l.sale_id '
        'WHERE s.deleted=0 AND l.deleted=0 AND s.created_at >= ? AND s.created_at < ?', variables: v).getSingle();
    final e = await db.customSelect(
        'SELECT COALESCE(SUM(amount),0) e FROM expenses WHERE deleted=0 AND created_at >= ? AND created_at < ?',
        variables: v).getSingle();
    final cost = c.read<double>('c');
    // discount reduces revenue; cost unaffected
    return Summary(sales: s.read<double>('t'), cost: cost, expenses: e.read<double>('e'), count: s.read<int>('c'));
  }

  /// Daily sales totals for a bar chart.
  Future<List<double>> dailySales(Period p) async {
    final rows = await db.customSelect(
        "SELECT substr(created_at,1,10) d, SUM(total) t FROM sales WHERE deleted=0 AND created_at >= ? AND created_at < ? GROUP BY d",
        variables: [Variable<DateTime>(p.from), Variable<DateTime>(p.to)]).get();
    final map = {for (final r in rows) r.read<String>('d'): r.read<double>('t')};
    final out = <double>[];
    for (var d = p.from; d.isBefore(p.to); d = d.add(const Duration(days: 1))) {
      out.add(map[d.toIso8601String().substring(0, 10)] ?? 0);
    }
    return out;
  }

  Future<List<(String, double, double)>> topItems(Period p, {int limit = 5}) async {
    final rows = await db.customSelect(
        'SELECT l.name n, SUM(l.qty) q, SUM(l.qty*l.price) a FROM sale_lines l JOIN sales s ON s.id=l.sale_id '
        'WHERE s.deleted=0 AND s.created_at >= ? AND s.created_at < ? GROUP BY l.name ORDER BY a DESC LIMIT ?',
        variables: [Variable<DateTime>(p.from), Variable<DateTime>(p.to), Variable.withInt(limit)]).get();
    return [for (final r in rows) (r.read<String>('n'), r.read<double>('q'), r.read<double>('a'))];
  }

  Future<double> totalBalance(String kind) async {
    final r = await db.customSelect(
        'SELECT COALESCE(SUM(l.amount),0) b FROM ledger l JOIN parties p ON p.id=l.party_id WHERE p.kind=? AND l.deleted=0',
        variables: [Variable.withString(kind)]).getSingle();
    return r.read<double>('b');
  }

  Future<double> stockValue() async {
    final r = await db.customSelect('SELECT COALESCE(SUM(stock*buy_price),0) v FROM items WHERE deleted=0').getSingle();
    return r.read<double>('v');
  }

  /// Money in each account: cash / bank / wallet.
  Future<Map<String, double>> accounts() async {
    final m = {'cash': 0.0, 'bank': 0.0, 'wallet': 0.0};
    void add(String? method, double v) => m[accountOf(method)] = m[accountOf(method)]! + v;
    for (final r in await db.customSelect("SELECT method, SUM(paid) v FROM sales WHERE deleted=0 GROUP BY method").get()) {
      add(r.read<String>('method'), r.read<double>('v'));
    }
    for (final r in await db.customSelect(
        "SELECT p.kind k, l.method m, SUM(l.amount) v FROM ledger l JOIN parties p ON p.id=l.party_id "
        "WHERE l.deleted=0 AND l.amount < 0 GROUP BY p.kind, l.method").get()) {
      final v = -r.read<double>('v');
      add(r.readNullable<String>('m'), r.read<String>('k') == 'customer' ? v : -v);
    }
    for (final r in await db.customSelect("SELECT method, SUM(amount) v FROM expenses WHERE deleted=0 GROUP BY method").get()) {
      add(r.read<String>('method'), -r.read<double>('v'));
    }
    for (final r in await db.customSelect("SELECT method, SUM(paid) v FROM purchases WHERE deleted=0 GROUP BY method").get()) {
      add(r.read<String>('method'), -r.read<double>('v'));
    }
    return m;
  }

  /// Load a few sample items so a new shop isn't empty (onboarding < 2 min).
  Future<void> seedSampleItems() async {
    const samples = [
      ('Dalda Ghee 1kg', 'Ghee/Tel', 520.0, 580.0),
      ('Super Basmati 5kg', 'Chawal', 1750.0, 1850.0),
      ('Coca-Cola 1.5L', 'Drinks', 165.0, 210.0),
      ('Lipton Chai 190g', 'Chai', 410.0, 450.0),
      ('Surf Excel 1kg', 'Masalay', 680.0, 750.0),
    ];
    for (final s in samples) {
      await saveItem(name: s.$1, category: s.$2, buyPrice: s.$3, sellPrice: s.$4, stock: 10, lowStockAt: 3);
    }
  }
}
