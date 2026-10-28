import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/i18n.dart';
import '../core/plan.dart';
import '../data/db.dart';
import '../data/repo.dart';
import '../data/sync.dart';
import '../services/auth.dart';
import '../services/printer.dart';

/// Overridden in main() / tests.
final dbProvider = Provider<AppDb>((_) => throw UnimplementedError());
final prefsProvider = Provider<SharedPreferences>((_) => throw UnimplementedError());
final authProvider = Provider<AuthService>((_) => DemoAuthService());
final remoteProvider = Provider<Remote?>((_) => null);

final repoProvider = Provider<Repo>((ref) => Repo(ref.watch(dbProvider)));
final printerProvider = Provider<PrinterService>((_) => PrinterService());
final syncProvider = Provider<SyncService?>((ref) {
  final r = ref.watch(remoteProvider);
  return r == null ? null : SyncService(ref.watch(dbProvider), r, ref.watch(prefsProvider));
});

final shopProvider = StreamProvider<Shop?>((ref) => ref.watch(repoProvider).watchShop());

class LangNotifier extends Notifier<Lang> {
  @override
  Lang build() => langFrom(ref.read(prefsProvider).getString('lang'));
  void set(Lang l) {
    state = l;
    ref.read(prefsProvider).setString('lang', l.name);
  }
}

final langProvider = NotifierProvider<LangNotifier, Lang>(LangNotifier.new);

final planProvider = Provider<PlanStatus?>((ref) {
  final s = ref.watch(shopProvider).value;
  return s == null ? null : PlanStatus(s.plan, s.trialEndsAt);
});

final itemsProvider = StreamProvider<List<Item>>((ref) => ref.watch(repoProvider).watchItems());
final lowStockProvider = StreamProvider<List<Item>>((ref) => ref.watch(repoProvider).watchLowStock());
final balancesProvider = StreamProvider.family<List<PartyBalance>, String>((ref, kind) => ref.watch(repoProvider).watchBalances(kind));
final ledgerProvider = StreamProvider.family<List<LedgerData>, String>((ref, id) => ref.watch(repoProvider).watchLedger(id));

/// Bumps whenever any table changes so FutureProviders below refresh.
final dbTickProvider = StreamProvider<int>((ref) {
  final db = ref.watch(dbProvider);
  var n = 0;
  return db.tableUpdates().map((_) => ++n);
});

class Dashboard {
  Dashboard(this.today, this.yesterday, this.receivable, this.payable, this.accounts, this.week);
  final Summary today, yesterday;
  final double receivable, payable;
  final Map<String, double> accounts;
  final List<double> week;
}

final dashboardProvider = FutureProvider<Dashboard>((ref) async {
  ref.watch(dbTickProvider);
  final r = ref.watch(repoProvider);
  final now = DateTime.now();
  final y = now.subtract(const Duration(days: 1));
  return Dashboard(await r.summary(Period.today(now)), await r.summary(Period.today(y)),
      await r.totalBalance('customer'), await r.totalBalance('supplier'), await r.accounts(), await r.dailySales(Period.of('week', now)));
});
