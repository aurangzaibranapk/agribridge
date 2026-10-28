import 'package:drift/drift.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'db.dart';

const _dateCols = {'updated_at', 'created_at', 'promise_date', 'trial_ends_at'};
const _boolCols = {'deleted'};

/// Same text format drift uses with store_date_time_values_as_text.
String driftDate(DateTime d) {
  if (d.isUtc) return d.toIso8601String();
  final o = d.timeZoneOffset;
  final sign = o.isNegative ? '-' : '+';
  final h = o.inHours.abs().toString().padLeft(2, '0');
  final m = (o.inMinutes.abs() % 60).toString().padLeft(2, '0');
  return '${d.toIso8601String()} $sign$h:$m';
}

DateTime parseDriftDate(String s) {
  final t = s.replaceFirst(' +', '+').replaceFirst(' -', '-');
  // sqlite CURRENT_TIMESTAMP ("2026-10-21 05:56:05") is UTC.
  return DateTime.parse(t.contains('T') ? t : '${t.replaceFirst(' ', 'T')}Z');
}

/// Local row (snake_case from sqlite) -> server json.
Map<String, dynamic> toServer(Map<String, dynamic> row) {
  final out = <String, dynamic>{};
  row.forEach((k, v) {
    if (k == 'dirty' || k == 'next_bill_no') return;
    if (v != null && _dateCols.contains(k)) {
      out[k] = parseDriftDate(v as String).toUtc().toIso8601String();
    } else if (_boolCols.contains(k)) {
      out[k] = v == 1 || v == true;
    } else {
      out[k] = v;
    }
  });
  return out;
}

/// Server json -> sqlite values (dirty = 0).
Map<String, Object?> fromServer(Map<String, dynamic> row) {
  final out = <String, Object?>{};
  row.forEach((k, v) {
    if (k == 'owner_id') return;
    if (v != null && _dateCols.contains(k)) {
      out[k] = driftDate(DateTime.parse(v as String).toLocal());
    } else if (_boolCols.contains(k)) {
      out[k] = v == true ? 1 : 0;
    } else if (v is num) {
      out[k] = v.toDouble() == v.toInt() && (k == 'bill_no') ? v.toInt() : v;
    } else {
      out[k] = v;
    }
  });
  out['dirty'] = 0;
  return out;
}

/// Abstraction over the remote so sync logic is unit-testable without a server.
abstract class Remote {
  Future<void> upsert(String table, List<Map<String, dynamic>> rows);
  Future<List<Map<String, dynamic>>> pull(String table, String shopId, DateTime since);
  Future<Map<String, dynamic>?> shop(String shopId);
}

class SupabaseRemote implements Remote {
  SupabaseRemote(this.client);
  final SupabaseClient client;
  SupabaseQueryBuilder _t(String t) => client.schema('dukandost').from(t);
  @override
  Future<void> upsert(String table, List<Map<String, dynamic>> rows) => _t(table).upsert(rows);
  @override
  Future<List<Map<String, dynamic>>> pull(String table, String shopId, DateTime since) async =>
      List<Map<String, dynamic>>.from(await _t(table).select().eq('shop_id', shopId).gt('updated_at', since.toUtc().toIso8601String()));
  @override
  Future<Map<String, dynamic>?> shop(String shopId) => _t('shops').select().eq('id', shopId).maybeSingle();
}

class SyncResult {
  SyncResult(this.pushed, this.pulled);
  final int pushed, pulled;
}

/// Offline-first sync: push dirty rows, then pull rows changed since last pull.
/// Conflicts: last write wins by updated_at (MVP is single-device per shop).
class SyncService {
  SyncService(this.db, this.remote, this.prefs);
  final AppDb db;
  final Remote remote;
  final SharedPreferences prefs;

  Future<SyncResult> run() async {
    final shop = await db.select(db.shops).getSingleOrNull();
    if (shop == null) return SyncResult(0, 0);
    var pushed = 0, pulled = 0;

    final shopRow = (await db.customSelect('SELECT * FROM shops WHERE id = ?', variables: [Variable(shop.id)]).getSingle()).data;
    if (shopRow['dirty'] == 1) {
      final j = toServer(shopRow)..remove('plan')..remove('trial_ends_at');
      await remote.upsert('shops', [j]);
      await db.customStatement('UPDATE shops SET dirty = 0 WHERE id = ?', [shop.id]);
      pushed++;
    }
    final server = await remote.shop(shop.id);
    if (server != null) {
      await db.customStatement('UPDATE shops SET plan = ?, trial_ends_at = ? WHERE id = ?',
          [server['plan'], driftDate(DateTime.parse(server['trial_ends_at'] as String).toLocal()), shop.id]);
    }

    for (final t in syncedTables) {
      final rows = await db.customSelect('SELECT * FROM $t WHERE dirty = 1').get();
      if (rows.isEmpty) continue;
      await remote.upsert(t, [for (final r in rows) toServer(r.data)]);
      for (final r in rows) {
        await db.customStatement('UPDATE $t SET dirty = 0 WHERE id = ? AND updated_at = ?', [r.data['id'], r.data['updated_at']]);
      }
      pushed += rows.length;
    }

    final key = 'dd_last_pull_${shop.id}';
    final since = DateTime.tryParse(prefs.getString(key) ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
    final started = DateTime.now().toUtc();
    for (final t in syncedTables) {
      final rows = await remote.pull(t, shop.id, since);
      for (final r in rows) {
        final v = fromServer(r);
        final local = await db.customSelect('SELECT dirty FROM $t WHERE id = ?', variables: [Variable(v['id'])]).getSingleOrNull();
        if (local != null && local.data['dirty'] == 1) continue; // local edit wins until pushed
        final cols = v.keys.toList();
        await db.customStatement(
            'INSERT OR REPLACE INTO $t (${cols.join(',')}) VALUES (${List.filled(cols.length, '?').join(',')})',
            [for (final c in cols) v[c]]);
        pulled++;
      }
    }
    await prefs.setString(key, started.toIso8601String());
    db.markTablesUpdated(db.allTables);
    return SyncResult(pushed, pulled);
  }
}
