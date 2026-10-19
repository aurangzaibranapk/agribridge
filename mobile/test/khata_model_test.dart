import 'package:agribridge/features/farmer/khata_model.dart';
import 'package:agribridge/core/data/mobile_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final rows = <Map<String, dynamic>>[
    {'entry_date': null, 'category': 'opening', 'kind': 'opening', 'tafseel': 'Pichhla baqaya', 'udhaar': 0, 'adaigi': 0, 'baqaya': 500, 'is_opening': true},
    {'entry_date': '2026-10-02', 'category': 'khaad', 'kind': 'udhaar', 'tafseel': 'Urea x2', 'udhaar': '8400', 'adaigi': 0, 'baqaya': 8900, 'is_opening': false},
    {'entry_date': '2026-10-05', 'category': 'adaigi', 'kind': 'adaigi', 'tafseel': 'Adaigi', 'udhaar': 0, 'adaigi': 4000, 'baqaya': 4900, 'is_opening': false},
    {'entry_date': '2026-10-06', 'category': 'naya_module', 'kind': 'udhaar', 'tafseel': '', 'udhaar': 10, 'adaigi': 0, 'baqaya': 4910, 'is_opening': false},
  ];

  test('statement: opening upar, baqi naye pehle', () {
    final lines = parseStatement(rows);
    expect(lines.first.isOpening, isTrue);
    expect(lines[1].category, 'naya_module');
    expect(lines.last.category, 'khaad');
    expect(lines.last.udhaar, 8400, reason: 'string numeric bhi parse ho');
  });

  test('adaigi ki pehchan', () {
    final lines = parseStatement(rows);
    expect(lines.firstWhere((l) => l.category == 'adaigi').isPayment, isTrue);
    expect(lines.firstWhere((l) => l.category == 'khaad').isPayment, isFalse);
  });

  test('filter chips sirf maujood categories, anjaan bhi', () {
    final cats = presentCategories(parseStatement(rows));
    expect(cats, ['khaad', 'adaigi', 'naya_module']);
    expect(khataCategoryLabel('karyana'), 'Karyana');
    expect(khataCategoryLabel('naya_module'), 'naya_module');
  });

  test('server ko tareekh YYYY-MM-DD', () {
    expect(isoDate(DateTime(2026, 3, 7)), '2026-03-07');
  });
}
