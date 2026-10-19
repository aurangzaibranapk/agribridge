import 'package:flutter/material.dart';

import '../../core/models/app_role.dart';
import '../dashboard/role_dashboard.dart';
import 'customer_screens.dart';
import 'farmer_screens.dart';
import 'staff_screens.dart';

/// Login ke baad sahi ghar: kisan, customer, ya staff (605 fn_mobile_whoami se).
/// Ye sirf UI hai -- har data call server par dobara role/branch jaanchti hai.
class RoleHome extends StatelessWidget {
  const RoleHome({super.key, required this.profile});
  final AppProfile profile;

  static String shellFor(AppRole role) => switch (role) {
        AppRole.farmer => 'farmer',
        AppRole.customer || AppRole.supplier => 'customer',
        AppRole.staff || AppRole.admin => 'staff',
        AppRole.dealer => 'dealer',
      };

  @override
  Widget build(BuildContext context) => switch (shellFor(profile.role)) {
        'farmer' => FarmerShell(profile: profile),
        'customer' => CustomerShell(profile: profile),
        'staff' => StaffShell(profile: profile),
        _ => RoleDashboard(profile: profile),
      };
}
