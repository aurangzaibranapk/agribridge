import 'package:flutter/material.dart';

import '../../core/models/app_role.dart';
import '../../core/theme/app_theme.dart';

class ModuleHub extends StatelessWidget {
  const ModuleHub({super.key, required this.title, required this.role});
  final String title;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    final entries = _entries(title, role);
    return Scaffold(
      appBar: AppBar(title: Text(title), backgroundColor: Colors.white),
      body: entries.isEmpty
          ? const Center(child: Text('Is module ka data login aur permission ke mutabiq khulega.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: entries.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => Card(child: ListTile(
                leading: CircleAvatar(backgroundColor: AppColors.mint, child: Icon(entries[i].$2, color: AppColors.green)),
                title: Text(entries[i].$1, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(entries[i].$3),
                trailing: const Icon(Icons.chevron_right),
              )),
            ),
    );
  }

  List<(String, IconData, String)> _entries(String tab, AppRole role) => switch (tab) {
        'Approvals' => const [('Credit Requests', Icons.credit_score, 'Pending customer and branch requests'), ('Staff Requests', Icons.people_outline, 'Access and operational approvals'), ('Purchase Approval', Icons.inventory_2_outlined, 'Bills and purchase review')],
        'Reports' => const [('Sales Report', Icons.trending_up, 'Branch and shop performance'), ('Profit & Loss', Icons.account_balance, 'Business position'), ('Stock Report', Icons.warehouse_outlined, 'Stock, expiry and shortage')],
        'My Work' => const [('Assigned Tasks', Icons.assignment_turned_in_outlined, 'Today and upcoming work'), ('Deliveries', Icons.local_shipping_outlined, 'Pending dispatch and receiving'), ('Stock Requests', Icons.inventory_outlined, 'Shop and warehouse requests')],
        'Khata' || 'Statement' => const [('All Transactions', Icons.receipt_long, 'Complete account statement'), ('Milk Payment', Icons.water_drop_outlined, 'Milk-only payment record'), ('FMCG Khata', Icons.shopping_basket_outlined, 'Shop purchase record')],
        'Services' => const [('Milk Collection', Icons.water_drop_outlined, 'Entries, quality and payment'), ('Machinery Booking', Icons.agriculture_outlined, 'Book machinery for farm'), ('Grain Sale', Icons.grass_outlined, 'Wheat and rice procurement'), ('Kisan AI', Icons.smart_toy_outlined, 'Farming help and expert escalation')],
        'Order' || 'Orders' => const [('New Order', Icons.add_shopping_cart, 'Products and stock availability'), ('Pending Orders', Icons.pending_actions, 'Orders awaiting action'), ('Order History', Icons.history, 'Delivered and cancelled orders')],
        'Payments' => const [('Make Payment', Icons.payments_outlined, 'Secure payment methods'), ('Payment History', Icons.receipt_outlined, 'Receipts and adjustments'), ('Credit Limit', Icons.speed, 'Used and available credit')],
        'Alerts' => const [('Notifications', Icons.notifications_outlined, 'Business and account updates'), ('Critical Alerts', Icons.warning_amber, 'Items requiring attention')],
        'Profile' || 'Menu' => const [('My Profile', Icons.person_outline, 'Identity, branch and contact'), ('Language', Icons.language, 'Urdu, Roman Urdu and English'), ('Privacy & Security', Icons.shield_outlined, 'Session and data controls'), ('Logout', Icons.logout, 'Securely end this session')],
        _ => const [],
      };
}
