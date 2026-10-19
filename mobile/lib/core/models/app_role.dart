enum AppRole { admin, farmer, staff, dealer, customer, supplier }

extension AppRoleX on AppRole {
  String get label => switch (this) {
        AppRole.admin => 'Admin',
        AppRole.farmer => 'Farmer',
        AppRole.staff => 'Staff',
        AppRole.dealer => 'Dealer',
        AppRole.customer => 'Customer',
        AppRole.supplier => 'Supplier',
      };

  static AppRole fromDatabase(String? role) => switch (role) {
        'owner' || 'super_admin' || 'admin' || 'manager' => AppRole.admin,
        'farmer' => AppRole.farmer,
        'dealer' => AppRole.dealer,
        'supplier' => AppRole.supplier,
        'sales_staff' ||
        'finance' ||
        'warehouse' ||
        'admin_assistant' ||
        'hr' ||
        'procurement' ||
        'milk_collection' ||
        'machinery' =>
          AppRole.staff,
        _ => AppRole.customer,
      };
}

class AppProfile {
  const AppProfile({
    required this.id,
    required this.name,
    required this.role,
    this.rawRole,
    this.branchId,
    this.shopId,
  });

  final String id;
  final String name;
  final AppRole role;
  final String? rawRole;
  final String? branchId;
  final String? shopId;
}
