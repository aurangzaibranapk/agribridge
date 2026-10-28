import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/providers.dart';
import 'i18n.dart';

typedef T = String Function(String key, [Map<String, String> args]);

T useT(WidgetRef ref) {
  final l = ref.watch(langProvider);
  return (k, [a = const {}]) => tr(l, k, a);
}
