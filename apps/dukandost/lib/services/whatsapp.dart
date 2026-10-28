/// Builds wa.me / sms links. Opening them shows a prefilled message; the
/// shopkeeper presses send themselves (no auto-send, no Business API cost).
String normalizePkPhone(String phone) {
  var d = phone.replaceAll(RegExp(r'[^0-9]'), '');
  if (d.startsWith('0092')) d = d.substring(2);
  if (d.startsWith('0')) d = '92${d.substring(1)}';
  if (d.length == 10 && d.startsWith('3')) d = '92$d';
  return d;
}

Uri whatsappUri(String? phone, String text) {
  final p = phone == null || phone.isEmpty ? '' : normalizePkPhone(phone);
  return Uri.parse('https://wa.me/$p?text=${Uri.encodeComponent(text)}');
}

Uri smsUri(String? phone, String text) =>
    Uri(scheme: 'sms', path: phone ?? '', queryParameters: {'body': text});
