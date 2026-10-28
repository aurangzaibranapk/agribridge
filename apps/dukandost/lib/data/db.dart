import 'package:drift/drift.dart';

part 'db.g.dart';

/// Columns shared by every synced table (offline-first, client-generated ids).
mixin Synced on Table {
  TextColumn get id => text()();
  TextColumn get shopId => text()();
  BoolColumn get deleted => boolean().withDefault(const Constant(false))();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  BoolColumn get dirty => boolean().withDefault(const Constant(true))();
  @override
  Set<Column> get primaryKey => {id};
}

class Shops extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get ownerName => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get address => text().nullable()();
  TextColumn get businessType => text().nullable()();
  TextColumn get lang => text().withDefault(const Constant('ur'))();
  TextColumn get plan => text().withDefault(const Constant('trial'))();
  DateTimeColumn get trialEndsAt => dateTime()();
  IntColumn get nextBillNo => integer().withDefault(const Constant(1))();
  BoolColumn get dirty => boolean().withDefault(const Constant(true))();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  @override
  Set<Column> get primaryKey => {id};
}

class Items extends Table with Synced {
  TextColumn get name => text()();
  TextColumn get barcode => text().nullable()();
  TextColumn get category => text().nullable()();
  TextColumn get unit => text().withDefault(const Constant('pcs'))();
  RealColumn get buyPrice => real().withDefault(const Constant(0))();
  RealColumn get sellPrice => real().withDefault(const Constant(0))();
  RealColumn get stock => real().withDefault(const Constant(0))();
  RealColumn get lowStockAt => real().withDefault(const Constant(0))();
}

class Parties extends Table with Synced {
  TextColumn get kind => text()(); // customer | supplier
  TextColumn get name => text()();
  TextColumn get phone => text().nullable()();
  RealColumn get creditLimit => real().nullable()();
  DateTimeColumn get promiseDate => dateTime().nullable()();
}

class Sales extends Table with Synced {
  IntColumn get billNo => integer()();
  TextColumn get partyId => text().nullable()();
  RealColumn get subtotal => real()();
  RealColumn get discount => real().withDefault(const Constant(0))();
  RealColumn get total => real()();
  RealColumn get paid => real().withDefault(const Constant(0))();
  TextColumn get method => text()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

class SaleLines extends Table with Synced {
  TextColumn get saleId => text()();
  TextColumn get itemId => text().nullable()();
  TextColumn get name => text()();
  RealColumn get qty => real()();
  RealColumn get price => real()();
  RealColumn get cost => real().withDefault(const Constant(0))();
}

class Purchases extends Table with Synced {
  TextColumn get partyId => text().nullable()();
  TextColumn get refNo => text().nullable()();
  RealColumn get total => real()();
  RealColumn get paid => real().withDefault(const Constant(0))();
  TextColumn get method => text().withDefault(const Constant('cash'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

class PurchaseLines extends Table with Synced {
  TextColumn get purchaseId => text()();
  TextColumn get itemId => text().nullable()();
  TextColumn get name => text()();
  RealColumn get qty => real()();
  RealColumn get price => real()();
}

/// Party khata. amount > 0 means the balance owed grows
/// (customer owes us / we owe supplier); < 0 is a payment.
class Ledger extends Table with Synced {
  TextColumn get partyId => text()();
  RealColumn get amount => real()();
  TextColumn get note => text().nullable()();
  TextColumn get method => text().nullable()();
  TextColumn get refType => text().nullable()();
  TextColumn get refId => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

class Expenses extends Table with Synced {
  TextColumn get category => text()();
  RealColumn get amount => real()();
  TextColumn get note => text().nullable()();
  TextColumn get method => text().withDefault(const Constant('cash'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

/// Tables pushed/pulled by SyncService, in FK-safe order.
const syncedTables = [
  'items', 'parties', 'sales', 'sale_lines', 'purchases', 'purchase_lines', 'ledger', 'expenses',
];

@DriftDatabase(tables: [Shops, Items, Parties, Sales, SaleLines, Purchases, PurchaseLines, Ledger, Expenses])
class AppDb extends _$AppDb {
  AppDb(super.e);
  @override
  int get schemaVersion => 1;
}
