import 'package:agribridge/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('bina dart-define: testing demo, production nahi', () {
    expect(AppConfig.environment, 'testing');
    expect(AppConfig.isProduction, isFalse);
    expect(AppConfig.demoMode, isTrue);
    expect(AppConfig.configurationError, isNull);
  });

  test('live project ref sahi', () {
    expect(AppConfig.liveProjectRef, 'ktskwawkslaznkjjacni');
  });
}
