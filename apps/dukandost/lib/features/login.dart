import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../core/t.dart';
import '../core/theme.dart';
import '../services/auth.dart';

class LangPicker extends ConsumerWidget {
  const LangPicker({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = ref.watch(langProvider);
    final t = useT(ref);
    return Wrap(crossAxisAlignment: WrapCrossAlignment.center, alignment: WrapAlignment.center, children: [
      Padding(padding: const EdgeInsetsDirectional.only(end: 4, bottom: 6), child: Text('${t('language')}:', style: kMuted)),
      Pill('اردو', on: l == Lang.ur, onTap: () => ref.read(langProvider.notifier).set(Lang.ur)),
      Pill('English', on: l == Lang.en, onTap: () => ref.read(langProvider.notifier).set(Lang.en)),
      Pill('Roman', on: l == Lang.roman, onTap: () => ref.read(langProvider.notifier).set(Lang.roman)),
    ]);
  }
}

class Brand extends StatelessWidget {
  const Brand({super.key, required this.tagline});
  final String tagline;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 84, height: 84, alignment: Alignment.center,
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
          child: const Text('D', style: TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: C.indigo)),
        ),
        const SizedBox(height: 22),
        const Text('DukanDost', style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800)),
        const Text.rich(TextSpan(text: 'Powered by ', children: [TextSpan(text: 'AgriBridge ERP', style: TextStyle(fontWeight: FontWeight.w700))]),
            style: TextStyle(color: Colors.white70, fontSize: 12)),
        const SizedBox(height: 8),
        Text(tagline, style: const TextStyle(color: Colors.white, fontSize: 16)),
      ]);
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginState();
}

class _LoginState extends ConsumerState<LoginScreen> {
  final phone = TextEditingController();
  final otp = TextEditingController();
  bool sent = false, busy = false;
  String? error;

  Future<void> _go() async {
    final auth = ref.read(authProvider);
    setState(() { busy = true; error = null; });
    try {
      if (!sent) {
        if (!validPkMobile(phone.text)) throw 'Mobile number theek nahi (03xx xxxxxxx)';
        await auth.sendOtp(phone.text);
        setState(() => sent = true);
      } else {
        if (!await auth.verify(phone.text, otp.text.trim())) throw 'OTP ghalat hai';
        if (!mounted) return;
        final shop = await ref.read(repoProvider).shop();
        if (!mounted) return;
        context.go(shop == null ? '/setup?phone=${Uri.encodeComponent(phone.text)}' : '/');
      }
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    final demo = ref.watch(authProvider).isDemo;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [C.indigo, C.teal], begin: Alignment.topLeft, end: Alignment.bottomRight)),
        child: SafeArea(
          child: ListView(padding: const EdgeInsets.fromLTRB(26, 60, 26, 26), children: [
            Brand(tagline: t('tagline')),
            const SizedBox(height: 60),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(t('login'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('phone'), controller: phone, keyboardType: TextInputType.phone, enabled: !sent,
                  decoration: const InputDecoration(hintText: '+92 300 1234567', prefixText: '🇵🇰  '),
                ),
                if (sent) ...[
                  const SizedBox(height: 10),
                  TextField(key: const Key('otp'), controller: otp, keyboardType: TextInputType.number, maxLength: 6,
                      decoration: InputDecoration(hintText: t('enter_otp'), counterText: '')),
                ],
                if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: C.red, fontSize: 12))),
                GradButton(sent ? t('verify') : t('send_otp'), onTap: busy ? null : _go, margin: const EdgeInsets.symmetric(vertical: 14)),
                const LangPicker(),
              ]),
            ),
            const SizedBox(height: 22),
            Text(t('offline_note'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 11)),
            if (demo) Padding(padding: const EdgeInsets.only(top: 6), child: Text(t('demo_mode'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54, fontSize: 10))),
          ]),
        ),
      ),
    );
  }
}

class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key, this.phone});
  final String? phone;
  @override
  ConsumerState<SetupScreen> createState() => _SetupState();
}

class _SetupState extends ConsumerState<SetupScreen> {
  final name = TextEditingController(), owner = TextEditingController(), address = TextEditingController();
  String type = 'Kiryana';
  bool samples = true;

  @override
  Widget build(BuildContext context) {
    final t = useT(ref);
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        Header(children: [Text(t('shop_setup'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))]),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(key: const Key('shopName'), controller: name, decoration: InputDecoration(labelText: t('shop_name'))),
          const SizedBox(height: 10),
          TextField(controller: owner, decoration: InputDecoration(labelText: t('owner_name'))),
          const SizedBox(height: 10),
          TextField(controller: address, decoration: InputDecoration(labelText: t('address'))),
          const SizedBox(height: 12),
          Text(t('business_type'), style: kMuted),
          const SizedBox(height: 6),
          Wrap(children: [
            for (final b in ['Kiryana', 'Medical', 'Hardware', 'Mobile', 'Kapra', 'Khaad-Beej'])
              Pill(b, on: type == b, onTap: () => setState(() => type = b)),
          ]),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: samples, onChanged: (v) => setState(() => samples = v), title: Text(t('sample_items'), style: const TextStyle(fontSize: 13))),
          const LangPicker(),
        ])),
        GradButton(t('start'), onTap: () async {
          if (name.text.trim().isEmpty) return;
          final repo = ref.read(repoProvider);
          await repo.createShop(name: name.text.trim(), ownerName: owner.text.trim(), address: address.text.trim(),
              phone: widget.phone, businessType: type, lang: ref.read(langProvider).name);
          if (samples) await repo.seedSampleItems();
          if (context.mounted) context.go('/');
        }),
      ]),
    );
  }
}
