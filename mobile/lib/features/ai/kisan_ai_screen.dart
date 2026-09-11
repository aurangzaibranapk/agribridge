import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';

class KisanAiScreen extends StatefulWidget {
  const KisanAiScreen({super.key});
  @override State<KisanAiScreen> createState() => _KisanAiScreenState();
}

class _KisanAiScreenState extends State<KisanAiScreen> {
  final input = TextEditingController();
  final messages = <({bool mine, String text})>[
    (mine: false, text: 'Assalam-o-Alaikum! Fasal, janwar, mausam ya apne AgriBridge record ke bare mein poochain.'),
  ];
  bool busy = false;

  Future<void> send() async {
    final text = input.text.trim();
    if (text.isEmpty || busy) return;
    setState(() { messages.add((mine: true, text: text)); input.clear(); busy = true; });
    try {
      if (!AppConfig.hasSupabase) {
        await Future<void>.delayed(const Duration(milliseconds: 500));
        setState(() => messages.add((mine: false, text: 'Testing preview: production mein ye sawal verified Kisan AI aur aapke farmer record se process hoga.')));
        return;
      }
      final session = Supabase.instance.client.auth.currentSession;
      final response = await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/api/mobile/farmer-ai'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${session?.accessToken ?? ''}'},
        body: jsonEncode({'message': text}),
      );
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode >= 400) throw Exception(body['error'] ?? 'AI response nahi mila.');
      final answer = body['answer'] ?? body['response'] ?? body['text'];
      setState(() => messages.add((mine: false, text: '$answer')));
    } catch (e) {
      setState(() => messages.add((mine: false, text: 'Maazrat, abhi jawab nahi mil saka: $e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Kisan AI'), actions: const [Padding(padding: EdgeInsets.only(right: 16), child: Icon(Icons.verified_user_outlined, color: AppColors.green))]),
    body: Column(children: [
      Container(width: double.infinity, color: AppColors.mint, padding: const EdgeInsets.all(12), child: const Text('AI mashwara madad ke liye hai. Pesticide, bemari aur financial faisle expert se verify karein.', style: TextStyle(fontSize: 10, color: AppColors.deepGreen), textAlign: TextAlign.center)),
      Expanded(child: ListView.builder(padding: const EdgeInsets.all(16), itemCount: messages.length, itemBuilder: (_, i) { final m = messages[i]; return Align(alignment: m.mine ? Alignment.centerRight : Alignment.centerLeft, child: Container(margin: const EdgeInsets.only(bottom: 10), constraints: const BoxConstraints(maxWidth: 310), padding: const EdgeInsets.all(13), decoration: BoxDecoration(color: m.mine ? AppColors.green : Colors.white, border: Border.all(color: m.mine ? AppColors.green : AppColors.line), borderRadius: BorderRadius.circular(16)), child: Text(m.text, style: TextStyle(color: m.mine ? Colors.white : AppColors.ink)))); })),
      SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [Expanded(child: TextField(controller: input, onSubmitted: (_) => send(), decoration: const InputDecoration(hintText: 'Apna sawal likhein...'))), const SizedBox(width: 8), IconButton.filled(onPressed: busy ? null : send, icon: busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send_rounded))]))),
    ]),
  );
}
