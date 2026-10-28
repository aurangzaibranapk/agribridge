import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/i18n.dart';
import '../core/theme.dart';
import '../features/bill.dart';
import '../features/expenses.dart';
import '../features/home.dart';
import '../features/khata.dart';
import '../features/login.dart';
import '../features/pos.dart';
import '../features/purchase.dart';
import '../features/reports.dart';
import '../features/settings.dart';
import '../features/stock.dart';
import 'providers.dart';

GoRouter buildRouter(Ref ref, {String initial = '/'}) => GoRouter(
      initialLocation: initial,
      redirect: (context, state) async {
        final loc = state.matchedLocation;
        final auth = ref.read(authProvider);
        if (!auth.signedIn) return loc == '/login' ? null : '/login';
        final shop = await ref.read(repoProvider).shop();
        if (shop == null && loc != '/setup') return '/setup';
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
        GoRoute(path: '/setup', builder: (_, s) => SetupScreen(phone: s.uri.queryParameters['phone'])),
        GoRoute(path: '/', builder: (_, s) => HomeShell(tab: int.tryParse(s.uri.queryParameters['tab'] ?? '') ?? 0)),
        GoRoute(path: '/sale', builder: (_, _) => const PosScreen()),
        GoRoute(path: '/bill/:id', builder: (_, s) => BillScreen(id: s.pathParameters['id']!)),
        GoRoute(path: '/party/:id', builder: (_, s) => PartyScreen(id: s.pathParameters['id']!)),
        GoRoute(path: '/item/new', builder: (_, s) => ItemForm(barcode: s.uri.queryParameters['barcode'])),
        GoRoute(path: '/item/:id', builder: (_, s) => ItemForm(id: s.pathParameters['id'])),
        GoRoute(path: '/scan', builder: (_, _) => const ScanScreen()),
        GoRoute(path: '/purchase', builder: (_, _) => const PurchaseScreen()),
        GoRoute(path: '/expenses', builder: (_, _) => const ExpensesScreen()),
        GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
        GoRoute(path: '/report/:kind', builder: (_, s) => ReportScreen(kind: s.pathParameters['kind']!, period: s.uri.queryParameters['period'] ?? 'month')),
      ],
    );

final initialRouteProvider = Provider<String>((_) => '/');
final routerProvider = Provider<GoRouter>((ref) => buildRouter(ref, initial: ref.read(initialRouteProvider)));

class DukanDostApp extends ConsumerWidget {
  const DukanDostApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langProvider);
    return MaterialApp.router(
      title: 'DukanDost',
      debugShowCheckedModeBanner: false,
      theme: appTheme(),
      locale: localeOf(lang),
      supportedLocales: const [Locale('ur'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
