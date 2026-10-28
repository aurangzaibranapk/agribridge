import 'package:intl/intl.dart';

final _f = NumberFormat('#,##,##0', 'en_IN');

/// Pakistani grouping: 126400 -> "Rs 1,26,400".
String rs(num v) => '${v < 0 ? '-' : ''}Rs ${_f.format(v.abs().round())}';

/// Short form for big tiles: 6800000 -> "Rs 68L", 6800 -> "Rs 6.8K".
String rsShort(num v) {
  final a = v.abs();
  if (a >= 100000) return 'Rs ${(a / 100000).toStringAsFixed(a >= 1000000 ? 0 : 1)}L';
  if (a >= 1000) return 'Rs ${(a / 1000).toStringAsFixed(1)}K';
  return rs(v);
}

String qtyStr(double q) => q == q.roundToDouble() ? q.toStringAsFixed(0) : q.toStringAsFixed(2);
