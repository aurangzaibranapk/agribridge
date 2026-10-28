import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../data/db.dart';
import '../core/t.dart';
import '../core/theme.dart';
import 'login.dart';

final _lastSync = StateProvider<String?>((_) => null);

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = useT(ref);
    final shop = ref.watch(shopProvider).value;
    final plan = ref.watch(planProvider);
    final sync = ref.watch(syncProvider);
    final lang = ref.watch(langProvider);
    final last = ref.watch(_lastSync);
    Widget sec(String title, List<Widget> rows) => AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: kBold), ...rows]));
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [
          InkWell(onTap: () => context.pop(), child: Text('← ${t('home')}', style: const TextStyle(fontSize: 12, color: Colors.white70))),
          const SizedBox(height: 6),
          Row(children: [
            Container(width: 46, height: 46, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle), child: Center(child: Avatar(shop?.name ?? '', size: 46))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(shop?.name ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              Text('${plan?.effective.toUpperCase() ?? ''} plan • 1 user', style: const TextStyle(fontSize: 12, color: Colors.white70)),
            ])),
          ]),
        ]),
        sec(t('shop'), [
          Li(left: Text('🏪 ${t('shop_info')}', style: const TextStyle(fontSize: 13)), right: const Icon(Icons.chevron_right, size: 18), onTap: () => _editShop(context, ref)),
          Li(left: Text('🧾 ${t('printer')}', style: const TextStyle(fontSize: 13)), right: const Icon(Icons.chevron_right, size: 18), onTap: () async {
            final list = await ref.read(printerProvider).paired().catchError((_) => <Never>[]);
            if (!context.mounted) return;
            showDialog(context: context, builder: (_) => AlertDialog(content: Text(list.isEmpty ? t('no_printer') : list.map((p) => '• ${p.name}').join('\n'))));
          }),
          Li(last: true, left: Text('🌐 ${t('language')}', style: const TextStyle(fontSize: 13)), right: Text(switch (lang) { Lang.ur => 'اردو', Lang.en => 'English', Lang.roman => 'Roman' }, style: kMuted)),
          const LangPicker(),
        ]),
        sec(t('data'), [
          Li(left: Text('☁️ ${t('sync')}', style: const TextStyle(fontSize: 13)), right: sync == null
              ? Flexible(child: Text(t('sync_local'), style: kMuted, textAlign: TextAlign.end))
              : TextButton(onPressed: () async {
                  try {
                    final r = await sync.run();
                    ref.read(_lastSync.notifier).state = '↑${r.pushed} ↓${r.pulled}';
                  } catch (e) {
                    ref.read(_lastSync.notifier).state = '$e';
                  }
                }, child: Text(last ?? t('sync_now')))),
          Li(last: true, left: const Text('🔒 App lock (PIN)', style: TextStyle(fontSize: 13)), right: const Text('v2', style: kMuted)),
        ]),
        Container(
          margin: const EdgeInsets.fromLTRB(14, 12, 14, 0),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(gradient: C.hot, borderRadius: BorderRadius.circular(18)),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('pro_plan'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
              Text('Rs 699/mahina${plan?.inTrial == true ? ' • ${plan!.trialDaysLeft} ${t('trial_left')}' : ''}', style: const TextStyle(color: Colors.white, fontSize: 12)),
            ])),
            FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: C.coral),
                onPressed: () => showDialog(context: context, builder: (_) => AlertDialog(content: Text(t('upgrade_soon')))), child: Text(t('upgrade'))),
          ]),
        ),
        sec(t('about'), [
          const Li(left: Text('📱 DukanDost', style: TextStyle(fontSize: 13)), right: Text('v1.0.0', style: kMuted)),
          const Padding(padding: EdgeInsets.only(top: 8), child: Center(child: Text.rich(TextSpan(text: 'Powered by ', children: [TextSpan(text: 'AgriBridge ERP', style: TextStyle(fontWeight: FontWeight.w700))]), style: kMuted))),
        ]),
        TextButton(onPressed: () async {
          await ref.read(authProvider).signOut();
          if (context.mounted) context.go('/login');
        }, child: Text(t('logout'), style: const TextStyle(color: C.red))),
        const SizedBox(height: 24),
      ]),
    );
  }

  Future<void> _editShop(BuildContext context, WidgetRef ref) async {
    final t = useT(ref);
    final s = ref.read(shopProvider).value;
    if (s == null) return;
    final name = TextEditingController(text: s.name), phone = TextEditingController(text: s.phone), address = TextEditingController(text: s.address);
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, decoration: InputDecoration(labelText: t('shop_name'))),
        const SizedBox(height: 8),
        TextField(controller: phone, decoration: InputDecoration(labelText: t('phone'))),
        const SizedBox(height: 8),
        TextField(controller: address, decoration: InputDecoration(labelText: t('address'))),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c, true), child: Text(t('save')))],
    ));
    if (ok == true) {
      await ref.read(repoProvider).updateShop(ShopsCompanion(name: Value(name.text.trim()), phone: Value(phone.text.trim()), address: Value(address.text.trim())));
    }
  }
}
