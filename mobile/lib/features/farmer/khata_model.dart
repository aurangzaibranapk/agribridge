/// Main ke ek hi khate (migration 565) ki lakeerein. Server ki category keys
/// yahan Roman Urdu labels se milti hain. Pure Dart, taake test ho sake.
class KhataLine {
  const KhataLine({
    required this.date,
    required this.category,
    required this.kind,
    required this.detail,
    required this.udhaar,
    required this.adaigi,
    required this.baqaya,
    required this.isOpening,
    this.ref,
  });

  final DateTime? date;
  final String category;
  final String kind;
  final String detail;
  final double udhaar;
  final double adaigi;
  final double baqaya;
  final bool isOpening;
  final String? ref;

  bool get isPayment => adaigi > 0 && udhaar == 0;

  static double _num(Object? value) => value is num ? value.toDouble() : double.tryParse('${value ?? ''}') ?? 0;

  factory KhataLine.fromRow(Map<String, dynamic> row) => KhataLine(
        date: DateTime.tryParse(row['entry_date']?.toString() ?? ''),
        category: row['category']?.toString() ?? 'deegar',
        kind: row['kind']?.toString() ?? '',
        detail: row['tafseel']?.toString() ?? '',
        udhaar: _num(row['udhaar']),
        adaigi: _num(row['adaigi']),
        baqaya: _num(row['baqaya']),
        isOpening: row['is_opening'] == true,
        ref: row['ref']?.toString(),
      );
}

const khataCategoryLabels = <String, String>{
  'karyana': 'Karyana',
  'khaad': 'Khaad / Beej / Spray',
  'vets': 'Vet',
  'doodh': 'Doodh',
  'gandum': 'Gandum',
  'machinery': 'Machinery',
  'qist': 'Qist',
  'purana': 'Purana hisaab',
  'adaigi': 'Adaigi',
  'naqad': 'Naqad udhaar',
  'dukaan': 'Dukaan',
  'deegar': 'Deegar',
  'opening': 'Pichhla baqaya',
};

String khataCategoryLabel(String key) => khataCategoryLabels[key] ?? key;

/// Statement ki lakeerein, naye pehle; opening hamesha upar.
List<KhataLine> parseStatement(List<Map<String, dynamic>> rows) {
  final lines = rows.map(KhataLine.fromRow).toList();
  final opening = lines.where((l) => l.isOpening).toList();
  final rest = lines.where((l) => !l.isOpening).toList().reversed.toList();
  return [...opening, ...rest];
}

/// Filter chips: sirf wo categories jin ki lakeer maujood ho.
List<String> presentCategories(Iterable<KhataLine> lines) {
  final seen = <String>{};
  for (final line in lines) {
    if (!line.isOpening) seen.add(line.category);
  }
  final ordered = khataCategoryLabels.keys.where(seen.contains).toList();
  ordered.addAll(seen.where((c) => !khataCategoryLabels.containsKey(c)));
  return ordered;
}
