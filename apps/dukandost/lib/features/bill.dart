import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app/providers.dart';
import '../core/money.dart';
import '../core/t.dart';
import '../core/theme.dart';
import '../services/bill.dart';
import '../services/whatsapp.dart';

final billProvider = FutureProvider.family<BillData?, String>((ref, id) async {
  final r = ref.watch(repoProvider);
  final s = await r.sale(id);
  final shop = await r.shop();
  if (s == null || shop == null) return null;
  return BillData(shop: shop, sale: s, lines: await r.saleLines(id), customer: s.partyId == null ? null : await r.party(s.partyId!));
});

class BillScreen extends ConsumerWidget {
  const BillScreen({super.key, required this.id});
  final String id;

  Future<File> _pdf(BillData b) async {
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/bill-${b.sale.billNo}.pdf');
    return f.writeAsBytes(await billPdf(b));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = useT(ref);
    final b = ref.watch(billProvider(id)).value;
    if (b == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    void snack(String s) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
    Widget share(String label, IconData ic, Color c, Future<void> Function() go) => Expanded(
          child: InkWell(
            key: Key('share_$label'),
            onTap: () => go().catchError((Object e) => snack('$e')),
            child: Column(children: [
              Container(height: 46, margin: const EdgeInsets.symmetric(horizontal: 4), decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(12)),
                  child: Center(child: Icon(ic, color: Colors.white))),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(fontSize: 10)),
            ]),
          ),
        );
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [
          Text('✅ ${t('bill_done')}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          Text('Bill #S-${b.sale.billNo} • ${DateFormat('d MMM yyyy, hh:mm a').format(b.sale.createdAt)}', style: const TextStyle(fontSize: 12, color: Colors.white70)),
        ]),
        AppCard(
          child: Text(billText(b), key: const Key('billText'), style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5, height: 1.35)),
        ),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t('send_bill'), style: kBold),
          const SizedBox(height: 10),
          Row(children: [
            share(t('whatsapp'), Icons.chat_rounded, const Color(0xFF25D366), () async {
              // Share the PDF; WhatsApp appears in the share sheet. Falls back to text via wa.me.
              final f = await _pdf(b);
              await SharePlus.instance.share(ShareParams(files: [XFile(f.path)], text: 'Bill #S-${b.sale.billNo} • ${rs(b.sale.total)}'));
            }),
            share(t('pdf'), Icons.picture_as_pdf_rounded, C.indigo, () async {
              final f = await _pdf(b);
              await SharePlus.instance.share(ShareParams(files: [XFile(f.path)]));
            }),
            share(t('print'), Icons.print_rounded, C.teal, () async {
              final ok = await ref.read(printerProvider).printBill(b);
              snack(ok ? t('printed') : t('no_printer'));
            }),
            share(t('sms'), Icons.sms_rounded, C.coral, () => launchUrl(smsUri(b.customer?.phone, billText(b)))),
          ]),
          const SizedBox(height: 4),
          TextButton(onPressed: () => launchUrl(whatsappUri(b.customer?.phone, billText(b)), mode: LaunchMode.externalApplication),
              child: const Text('WhatsApp (text)', style: TextStyle(fontSize: 11))),
        ])),
        GradButton('+ ${t('new_sale')}', key: const Key('again'), onTap: () => context.pushReplacement('/sale')),
        const SizedBox(height: 24),
      ]),
    );
  }
}
