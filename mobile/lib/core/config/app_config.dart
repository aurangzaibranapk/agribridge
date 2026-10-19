abstract final class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const environment = String.fromEnvironment('APP_ENV', defaultValue: 'testing');
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const firebaseMessagingEnabled = bool.fromEnvironment('FIREBASE_MESSAGING_ENABLED', defaultValue: false);
  static const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');

  /// Live project ref. Production build sirf isi se jurta hai (CI bhi jaanchta hai).
  static const liveProjectRef = 'ktskwawkslaznkjjacni';

  static bool get hasSupabase =>
      supabaseUrl.startsWith('https://') && supabaseAnonKey.isNotEmpty;
  static bool get isProduction => environment == 'production';
  static bool get demoMode => !isProduction && !hasSupabase;
  static bool get hasApiBaseUrl => apiBaseUrl.startsWith('https://');

  /// Production build bina sahi config ke chalne na paye.
  static String? get configurationError {
    if (environment != 'production' && environment != 'testing') return 'APP_ENV sirf production ya testing';
    if (isProduction && !hasSupabase) return 'Production build mein Supabase config nahi';
    if (isProduction && !supabaseUrl.contains(liveProjectRef)) return 'Production build live project se nahi jura';
    return null;
  }
}
