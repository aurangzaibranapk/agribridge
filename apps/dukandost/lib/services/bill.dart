import 'dart:convert';
import 'dart:typed_data';

import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../core/money.dart';
import '../data/db.dart';

const poweredBy = 'DukanDost • Powered by AgriBridge ERP';

class BillData {
  BillData({required this.shop, required this.sale, required this.lines, this.customer});
  final Shop shop;
  final Sale sale;
  final List<SaleLine> lines;
  final Party? customer;
  double get due => sale.total - sale.paid;
}

String methodLabel(String m) => switch (m) {
      'jazzcash' => 'JazzCash', 'easypaisa' => 'Easypaisa', 'bank' => 'Bank', 'udhaar' => 'Udhaar', _ => 'Cash',
    };

/// Plain-text receipt, used for the on-screen preview, SMS and thermal print.
String billText(BillData b, {int width = 32}) {
  String row(String l, String r) {
    final space = width - l.length - r.length;
    if (space < 1) return '${l.substring(0, (width - r.length - 1).clamp(0, l.length))} $r';
    return l + ' ' * space + r;
  }
  String center(String s) {
    if (s.length <= width) return ' ' * ((width - s.length) ~/ 2) + s;
    final lines = <String>[];
    var cur = '';
    for (final w in s.split(' ')) {
      if (cur.isNotEmpty && cur.length + 1 + w.length > width) { lines.add(cur); cur = w; } else { cur = cur.isEmpty ? w : '$cur $w'; }
    }
    lines.add(cur);
    return lines.map((l) => l.length > width ? l.substring(0, width) : ' ' * ((width - l.length) ~/ 2) + l).join('\n');
  }
  final f = NumberFormat('#,##,##0', 'en_IN');
  final buf = StringBuffer()
    ..writeln(center(b.shop.name))
    ..writeln(center([b.shop.address, b.shop.phone].whereType<String>().where((s) => s.isNotEmpty).join(' • ')))
    ..writeln('-' * width)
    ..writeln(row('Bill #${b.sale.billNo}', DateFormat('dd-MM-yy hh:mm a').format(b.sale.createdAt)));
  if (b.customer != null) buf.writeln('Customer: ${b.customer!.name}');
  buf.writeln('-' * width);
  for (final l in b.lines) {
    buf.writeln(row('${l.name} x${qtyStr(l.qty)}', f.format((l.qty * l.price).round())));
  }
  buf.writeln('-' * width);
  if (b.sale.discount > 0) buf.writeln(row('Discount', '-${f.format(b.sale.discount.round())}'));
  buf
    ..writeln(row('KUL', 'Rs ${f.format(b.sale.total.round())}'))
    ..writeln(row('Ada: ${methodLabel(b.sale.method)}', 'Baqi: ${f.format(b.due.round())}'))
    ..writeln('-' * width)
    ..writeln(center('Shukriya! Dobara tashreef layein'))
    ..writeln(center(poweredBy));
  return buf.toString();
}

Future<Uint8List> billPdf(BillData b) async {
  final doc = pw.Document(title: 'Bill ${b.sale.billNo}', author: b.shop.name);
  final mono = pw.Font.courier();
  doc.addPage(pw.Page(
    pageFormat: const PdfPageFormat(80 * PdfPageFormat.mm, 200 * PdfPageFormat.mm, marginAll: 4 * PdfPageFormat.mm),
    build: (_) => pw.Text(billText(b, width: 36), style: pw.TextStyle(font: mono, fontSize: 8)),
  ));
  return doc.save();
}

/// Minimal ESC/POS: init, text (ASCII), feed, cut. Works on common 58/80mm printers.
List<int> escPos(String text) => [
      0x1B, 0x40, // init
      ...latin1.encode(text.replaceAll(RegExp(r'[^\x00-\xFF]'), '?')),
      0x0A, 0x0A, 0x0A,
      0x1D, 0x56, 0x42, 0x00, // partial cut
    ];
