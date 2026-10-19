import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_config.dart';

/// Server (605/606) se baat. Demo mode mein namoona data.
class RoleRepository {
  SupabaseClient get _c => Supabase.instance.client;

  /// 605 fn_mobile_whoami. Agar migration abhi live nahi to null (purana profile routing chalega).
  Future<Map<String, dynamic>?> whoami() async {
    if (!AppConfig.hasSupabase) return null;
    try {
      final r = await _c.rpc('fn_mobile_whoami');
      return r is Map ? Map<String, dynamic>.from(r) : null;
    } on PostgrestException {
      return null;
    }
  }

  Future<Map<String, dynamic>> staffSummary() async =>
      Map<String, dynamic>.from(await _c.rpc('fn_staff_home_summary') as Map);

  Future<List<Map<String, dynamic>>> partySearch({String? q, String kind = 'all', int? minAge}) async {
    final r = await _c.rpc('fn_staff_party_search', params: {'p_q': q, 'p_kind': kind, 'p_min_age_days': minAge});
    return List<Map<String, dynamic>>.from((r as List).map((e) => Map<String, dynamic>.from(e as Map)));
  }

  Future<Map<String, dynamic>> partyView(String id) async =>
      Map<String, dynamic>.from(await _c.rpc('fn_staff_party_view', params: {'p_party': id}) as Map);

  /// 606: hamesha PENDING. client_uuid se dobara bhejna mehfooz.
  Future<Map<String, dynamic>> submitEntry(StaffEntryDraft d) async =>
      Map<String, dynamic>.from(await _c.rpc('fn_staff_submit_entry', params: d.toParams()) as Map);

  Future<List<Map<String, dynamic>>> myEntries() async {
    final r = await _c.rpc('fn_staff_my_entries');
    return List<Map<String, dynamic>>.from((r as List).map((e) => Map<String, dynamic>.from(e as Map)));
  }

  /// Kisan ka apna record (RLS: sirf apni row).
  Future<Map<String, dynamic>?> myFarmerRow() async {
    final uid = _c.auth.currentUser?.id;
    if (uid == null) return null;
    try {
      return await _c
          .from('farmers')
          .select('id, farmer_code, full_name, land_size_acres, crop_types, cow_count, buffalo_count, calves_count, milking_animal_count, milk_liters_per_day, milk_buyer_name, milk_sale_rate, milk_advance_loan_amount')
          .eq('user_id', uid)
          .maybeSingle();
    } on PostgrestException {
      return null;
    }
  }

  /// Category-first demand (604). Farmer RLS: sirf apni demand.
  Future<void> submitDemand({required String farmerId, required String category, required String product, required double qty, required String unit, String? notes}) async {
    await _c.from('farmer_product_demands').insert({
      'farmer_id': farmerId, 'category': category, 'product_name': product, 'quantity': qty, 'unit': unit, 'notes': notes,
    });
  }
}

class StaffEntryDraft {
  StaffEntryDraft({required this.clientUuid, required this.kind, required this.partyId, this.amount, this.method, this.note});
  final String clientUuid;
  final String kind; // recovery|milk|cash_sale|promise|demand|visit_note
  final String partyId;
  final double? amount;
  final String? method;
  final String? note;
  static const kinds = ['recovery', 'milk', 'cash_sale', 'promise', 'demand', 'visit_note'];
  static const needsAmount = {'recovery', 'milk', 'cash_sale', 'promise'};
  String? validate() {
    if (!kinds.contains(kind)) return 'Entry ki qism ghalat';
    if (partyId.isEmpty) return 'Party chunein';
    if (needsAmount.contains(kind) && (amount == null || amount! <= 0)) return 'Raqam likhein';
    if ((note ?? '').length > 1000) return 'Note bohat lamba';
    return null;
  }

  Map<String, dynamic> toParams() => {
        'p_client_uuid': clientUuid, 'p_kind': kind, 'p_party': partyId, 'p_amount': amount, 'p_method': method, 'p_note': note,
      };
}

/// Product Demand qismein (owner ka faisla: pehle qism).
class DemandCategory {
  const DemandCategory(this.code, this.en, this.roman, this.ur, this.unit);
  final String code;
  final String en;
  final String roman;
  final String ur;
  final String unit;
  static const all = [
    DemandCategory('karyana', 'Grocery', 'Karyana', 'کریانہ', 'packet'),
    DemandCategory('fertilizer', 'Fertilizer', 'Khaad', 'کھاد', 'bori'),
    DemandCategory('pesticide', 'Spray', 'Spray', 'سپرے', 'bottle'),
    DemandCategory('seed', 'Seed', 'Beej', 'بیج', 'bag'),
    DemandCategory('wanda', 'Feed (Wanda)', 'Wanda', 'ونڈا', 'bori'),
    DemandCategory('other', 'Other', 'Other', 'دیگر', 'other'),
  ];
}

/// WhatsApp link (staff confirm ke baad hi khulta hai). Number 92 se.
Uri whatsappUri(String phone, String text) {
  var digits = phone.replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('0')) digits = '92${digits.substring(1)}';
  return Uri.parse('https://wa.me/$digits?text=${Uri.encodeComponent(text)}');
}

String maskPhone(String? p) {
  final d = (p ?? '').replaceAll(RegExp(r'\D'), '');
  if (d.length < 6) return p ?? '';
  return '${d.substring(0, 4)}${'x' * (d.length - 6)}${d.substring(d.length - 2)}';
}

final roleRepositoryProvider = Provider((_) => RoleRepository());

/// Demo mein kis role ka namoona chal raha hai.
final demoKindProvider = StateProvider<String>((_) => 'farmer');

final farmerRowProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  if (AppConfig.demoMode) return demoFarmerRow;
  if (!AppConfig.hasSupabase) return null;
  return ref.read(roleRepositoryProvider).myFarmerRow();
});

final staffSummaryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  if (AppConfig.demoMode) return demoStaffSummary;
  return ref.read(roleRepositoryProvider).staffSummary();
});

final partyQueryProvider = StateProvider<({String q, String kind, int? minAge})>((_) => (q: '', kind: 'all', minAge: null));

final partyListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final f = ref.watch(partyQueryProvider);
  if (AppConfig.demoMode) {
    final q = f.q.toLowerCase();
    return demoParties.where((p) {
      if (f.kind != 'all' && p['kind'] != f.kind) return false;
      if (f.minAge != null && ((p['age_days'] as int?) ?? 0) < f.minAge!) return false;
      return q.isEmpty || (p['name'] as String).toLowerCase().contains(q) || (p['code'] as String).toLowerCase().contains(q);
    }).toList();
  }
  return ref.read(roleRepositoryProvider).partySearch(q: f.q.isEmpty ? null : f.q, kind: f.kind, minAge: f.minAge);
});

final partyViewProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  if (AppConfig.demoMode) return demoPartyView(id);
  return ref.read(roleRepositoryProvider).partyView(id);
});

final myEntriesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  if (AppConfig.demoMode) return ref.watch(demoEntriesProvider);
  return ref.read(roleRepositoryProvider).myEntries();
});

final demoEntriesProvider = StateProvider<List<Map<String, dynamic>>>((_) => const [
      {'id': 'e0', 'kind': 'recovery', 'party': 'Demo Kisan D', 'amount': 5000, 'status': 'approved', 'created_at': '2026-10-18T11:00:00'},
    ]);

// ------------------------------------------------------------------ demo
const demoFarmerRow = <String, dynamic>{
  'id': 'demo-farmer', 'farmer_code': 'FRM-DEMO-01', 'full_name': 'Kisan Ahmed (Demo)', 'land_size_acres': 12.5,
  'crop_types': ['Gandum', 'Munji'], 'cow_count': 5, 'buffalo_count': 3, 'calves_count': 1, 'milking_animal_count': 5,
  'milk_liters_per_day': 64, 'milk_buyer_name': 'Demo Milk Centre', 'milk_sale_rate': 180, 'milk_advance_loan_amount': 8000,
};

const demoDairy = <String, dynamic>{
  'today_l': 64.0, 'fat': 4.3, 'lr': 27.2, 'total': 9, 'milking': 5, 'pregnant': 2, 'dry': 2,
};

const demoCustomer = <String, dynamic>{
  'name': 'Demo Karyana Store', 'code': 'CUS-DEMO-07', 'branch': 'Mahabali', 'due': 126300, 'last_payment': 20000, 'last_payment_date': '14 Oct',
  'bills': 12, 'orders_pending': 2, 'promises': 1,
};

const demoCustomerKhata = <Map<String, dynamic>>[
  {'title': 'Bill #K-3301', 'sub': 'Karyana maal', 'amount': -34800, 'date': '16 Oct'},
  {'title': 'Cash received', 'sub': 'Receipt #R-610', 'amount': 20000, 'date': '14 Oct'},
  {'title': 'Bill #K-3277', 'sub': 'Chawal, cheeni', 'amount': -22150, 'date': '09 Oct'},
  {'title': 'Bill #K-3240', 'sub': 'Ghee, daal', 'amount': -18400, 'date': '02 Oct'},
];

const demoFarmerTx = <Map<String, dynamic>>[
  {'title': 'Khaad (DAP) — Bill #D-1021', 'sub': '2 bori', 'amount': -28400, 'date': '12 Oct', 'icon': 'khaad'},
  {'title': 'Milk payment', 'sub': '118 L × 180', 'amount': 21240, 'date': '10 Oct', 'icon': 'milk'},
  {'title': 'Cash recovery', 'sub': 'Receipt #R-552', 'amount': 10000, 'date': '05 Oct', 'icon': 'cash'},
  {'title': 'Spray (Alto)', 'sub': '1 bottle', 'amount': -3950, 'date': '02 Oct', 'icon': 'spray'},
  {'title': 'Season Plan Gandum', 'sub': 'Advance input', 'amount': -18000, 'date': '28 Sep', 'icon': 'season'},
];

const demoStaffSummary = <String, dynamic>{
  'sales_today': 184600, 'bills_today': 23, 'recovery_today': 62000, 'branch_due': 3840000, 'parties_due': 214,
  'promises_today': 11, 'promises_today_amount': 210000, 'pending_orders': 5, 'pending_entries': 4, 'pending_demands': 7, 'pending_bookings': 3,
};

const demoParties = <Map<String, dynamic>>[
  {'id': 'p-a', 'name': 'Demo Party A', 'kind': 'customer', 'code': 'CUS-D-011', 'phone_masked': '0300xxxxx21', 'due': 85000, 'age_days': 45, 'next_promise': '2026-10-19'},
  {'id': 'p-b', 'name': 'Demo Kisan B', 'kind': 'farmer', 'code': 'FRM-D-102', 'phone_masked': '0301xxxxx45', 'due': 52300, 'age_days': 64, 'next_promise': null},
  {'id': 'p-c', 'name': 'Demo Store C', 'kind': 'customer', 'code': 'CUS-D-020', 'phone_masked': '0302xxxxx10', 'due': 18500, 'age_days': 30, 'next_promise': '2026-10-20'},
  {'id': 'p-d', 'name': 'Demo Kisan D', 'kind': 'farmer', 'code': 'FRM-D-145', 'phone_masked': '0303xxxxx77', 'due': 31200, 'age_days': 21, 'next_promise': null},
  {'id': 'p-e', 'name': 'Demo Kisan E', 'kind': 'farmer', 'code': 'FRM-D-150', 'phone_masked': '0304xxxxx02', 'due': 9800, 'age_days': 12, 'next_promise': null},
  {'id': 'p-f', 'name': 'Demo Store F', 'kind': 'customer', 'code': 'CUS-D-033', 'phone_masked': '0305xxxxx66', 'due': 4250, 'age_days': 8, 'next_promise': null},
  {'id': 'p-g', 'name': 'Demo Kisan G', 'kind': 'farmer', 'code': 'FRM-D-171', 'phone_masked': '0306xxxxx90', 'due': 0, 'age_days': null, 'next_promise': null},
];

Map<String, dynamic> demoPartyView(String id) {
  final p = demoParties.firstWhere((e) => e['id'] == id, orElse: () => demoParties[1]);
  return {
    ...p, 'phone': '03000000000', 'credit_limit': 310000,
    'khata': const [
      {'date': '2026-10-11', 'ref': 'Bill #D-1104', 'source': 'pos', 'debit': 13500, 'credit': 0},
      {'date': '2026-10-10', 'ref': 'Milk 15 din', 'source': 'milk', 'debit': 0, 'credit': 17280},
      {'date': '2026-10-01', 'ref': 'Recovery', 'source': 'recovery_money', 'debit': 0, 'credit': 5000},
      {'date': '2026-09-20', 'ref': 'Bill #D-1033', 'source': 'pos', 'debit': 61080, 'credit': 0},
    ],
    'promises': const [{'id': 'pr1', 'amount': 15000, 'date': '2026-10-25', 'status': 'open'}],
  };
}
