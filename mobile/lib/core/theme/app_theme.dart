import 'package:flutter/material.dart';

abstract final class AppColors {
  static const navy = Color(0xFF062E46);
  static const green = Color(0xFF08783E);
  static const deepGreen = Color(0xFF075A32);
  static const mint = Color(0xFFF0F8F3);
  static const gold = Color(0xFFD6A02B);
  static const ink = Color(0xFF172126);
  static const muted = Color(0xFF6C7A7A);
  static const line = Color(0xFFDCE7E0);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.green,
    primary: AppColors.green,
    secondary: AppColors.gold,
    surface: Colors.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: const Color(0xFFF6F8F6),
    fontFamily: 'Roboto',
    cardTheme: const CardTheme(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(18)),
        side: BorderSide(color: AppColors.line),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: AppColors.line),
      ),
    ),
  );
}
