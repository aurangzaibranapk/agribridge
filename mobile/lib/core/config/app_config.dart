abstract final class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const environment = String.fromEnvironment('APP_ENV', defaultValue: 'testing');
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://alranatraders.pk');
  static const firebaseMessagingEnabled = bool.fromEnvironment('FIREBASE_MESSAGING_ENABLED', defaultValue: false);

  static bool get hasSupabase =>
      supabaseUrl.startsWith('https://') && supabaseAnonKey.isNotEmpty;
  static bool get isProduction => environment == 'production';
}
