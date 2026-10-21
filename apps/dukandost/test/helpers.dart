import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:dukandost/data/db.dart';
import 'package:dukandost/data/repo.dart';

AppDb memDb() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  return AppDb(NativeDatabase.memory());
}

Future<(AppDb, Repo)> seeded() async {
  final db = memDb();
  final r = Repo(db);
  await r.createShop(name: 'Bismillah Kiryana Store', phone: '03001234567');
  return (db, r);
}
