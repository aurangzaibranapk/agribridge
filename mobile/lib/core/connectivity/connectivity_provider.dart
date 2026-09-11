import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final connectivityProvider = StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

bool isOffline(List<ConnectivityResult>? results) {
  return results != null && results.isNotEmpty && results.every((result) => result == ConnectivityResult.none);
}
