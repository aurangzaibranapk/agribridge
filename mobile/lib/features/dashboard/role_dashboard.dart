import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_controller.dart';
import '../../core/models/app_role.dart';
import '../../core/theme/app_theme.dart';
import '../modules/module_hub.dart';
import 'screens/admin_dashboard.dart';
import 'screens/dealer_dashboard.dart';
import 'screens/farmer_dashboard.dart';
import 'screens/staff_dashboard.dart';

class RoleDashboard extends ConsumerStatefulWidget {
  const RoleDashboard({super.key, required this.profile});
  final AppProfile profile;

  @override
  ConsumerState<RoleDashboard> createState() => _RoleDashboardState();
}

class _RoleDashboardState extends ConsumerState<RoleDashboard> {
  int index = 0;

  List<_NavItem> get items => switch (widget.profile.role) {
        AppRole.admin => const [
            _NavItem('Home', Icons.home_rounded), _NavItem('Approvals', Icons.fact_check_outlined), _NavItem('Reports', Icons.bar_chart_rounded), _NavItem('Alerts', Icons.notifications_outlined), _NavItem('Menu', Icons.menu_rounded),
          ],
        AppRole.staff => const [
            _NavItem('Dashboard', Icons.dashboard_rounded), _NavItem('My Work', Icons.assignment_outlined), _NavItem('Scan', Icons.qr_code_scanner_rounded), _NavItem('Alerts', Icons.notifications_outlined), _NavItem('Menu', Icons.menu_rounded),
          ],
        AppRole.dealer => const [
            _NavItem('Home', Icons.home_rounded), _NavItem('Order', Icons.shopping_cart_outlined), _NavItem('Statement', Icons.receipt_long_outlined), _NavItem('Payments', Icons.credit_card_outlined), _NavItem('Profile', Icons.person_outline),
          ],
        _ => const [
            _NavItem('Home', Icons.home_rounded), _NavItem('Khata', Icons.account_balance_wallet_outlined), _NavItem('Services', Icons.handyman_outlined), _NavItem('Orders', Icons.shopping_cart_outlined), _NavItem('Profile', Icons.person_outline),
          ],
      };

  Widget get home => switch (widget.profile.role) {
        AppRole.admin => AdminDashboard(profile: widget.profile),
        AppRole.staff => StaffDashboard(profile: widget.profile),
        AppRole.dealer => DealerDashboard(profile: widget.profile),
        _ => FarmerDashboard(profile: widget.profile),
      };

  @override
  Widget build(BuildContext context) {
    final body = index == 0 ? home : ModuleHub(title: items[index].label, role: widget.profile.role);
    return Scaffold(
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        indicatorColor: AppColors.green.withValues(alpha: .14),
        destinations: items.map((item) => NavigationDestination(icon: Icon(item.icon), label: item.label)).toList(),
      ),
      floatingActionButton: widget.profile.role == AppRole.farmer
          ? FloatingActionButton.extended(onPressed: () {}, backgroundColor: AppColors.green, foregroundColor: Colors.white, icon: const Icon(Icons.smart_toy_outlined), label: const Text('Kisan AI'))
          : null,
    );
  }
}

class _NavItem {
  const _NavItem(this.label, this.icon);
  final String label;
  final IconData icon;
}
