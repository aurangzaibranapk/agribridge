import 'package:agribridge/core/models/app_role.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('ERP staff roles map to staff mobile experience', () {
    for (final role in ['sales_staff', 'finance', 'warehouse', 'hr', 'procurement', 'milk_collection', 'machinery']) {
      expect(AppRoleX.fromDatabase(role), AppRole.staff);
    }
  });

  test('master roles map to admin mobile experience', () {
    for (final role in ['owner', 'super_admin', 'admin', 'manager']) {
      expect(AppRoleX.fromDatabase(role), AppRole.admin);
    }
  });
}
