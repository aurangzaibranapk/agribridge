/// Free / Pro plan flags with a 14-day trial. Billing itself is not wired yet
/// (Play Billing / JazzCash decision pending); the server column `plan` is the
/// source of truth once sync is on, and is not client-writable (see RLS).
enum Feature { unlimitedItems, whatsappReminders, reports, cloudBackup }

class PlanStatus {
  PlanStatus(this.plan, this.trialEndsAt, [DateTime? now]) : now = now ?? DateTime.now();
  final String plan; // free | trial | pro | business
  final DateTime trialEndsAt;
  final DateTime now;

  static const freeItemLimit = 100;

  bool get inTrial => plan == 'trial' && now.isBefore(trialEndsAt);
  int get trialDaysLeft => inTrial ? (trialEndsAt.difference(now).inHours / 24).ceil() : 0;
  String get effective => plan == 'trial' ? (inTrial ? 'trial' : 'free') : plan;
  bool get isPaid => effective == 'pro' || effective == 'business';
  bool get hasPro => isPaid || inTrial;

  bool allows(Feature f) => hasPro;
  bool canAddItem(int currentCount) => hasPro || currentCount < freeItemLimit;
}
