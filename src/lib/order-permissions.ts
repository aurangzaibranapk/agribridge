import { createClient } from "@/lib/supabase/server";

const HQ_ROLES = ["super_admin", "admin", "owner"];

export interface OrderPermissions {
  role: string | null;
  isOwnerBranch: boolean;
  isSourceBranch: boolean;

  canSalesVerify: boolean;
  canFinanceVerify: boolean;
  canVerifyPayment: boolean;
  canApprove: boolean;
  canCreateDispatch: boolean;
  canVerifyGrnDiscrepancy: boolean;

  canSubmitPayment: boolean;
  canConfirmDelivery: boolean;
  canCreateGrn: boolean;
  canSubmitComplaint: boolean;
  canReject: boolean;

  canSeePayments: boolean;
  canSeeDispatch: boolean;
  canSeeGrn: boolean;
  canSeeComplaints: boolean;
}

export async function getOrderPermissions(
  orderToBranchId: string | null,
  orderFromBranchId: string | null = null
): Promise<OrderPermissions> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      role: null,
      isOwnerBranch: false,
      isSourceBranch: false,
      canSalesVerify: false,
      canFinanceVerify: false,
      canVerifyPayment: false,
      canApprove: false,
      canCreateDispatch: false,
      canVerifyGrnDiscrepancy: false,
      canSubmitPayment: false,
      canConfirmDelivery: false,
      canCreateGrn: false,
      canSubmitComplaint: false,
      canReject: false,
      canSeePayments: false,
      canSeeDispatch: false,
      canSeeGrn: false,
      canSeeComplaints: false,
    };
  }

  const { data: profile } = await supabase.from("profiles").select("role, branch_id").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? null;
  const isOwnerBranch = !!profile?.branch_id && !!orderToBranchId && profile.branch_id === orderToBranchId;
  const isSourceBranch = !!profile?.branch_id && !!orderFromBranchId && profile.branch_id === orderFromBranchId;
  const isHQ = role ? HQ_ROLES.includes(role) : false;
  const isManager = role === "manager";

  const hqGate = !isOwnerBranch;
  const seesEverything = isHQ || isManager || isOwnerBranch || isSourceBranch;

  // Admin/owner/super_admin — branch setting se qata nazar, sab kuch
  // kar sakte hain. Baqi staff ke liye hqGate aur role-based pabandi.
  return {
    role,
    isOwnerBranch,
    isSourceBranch,
    canSalesVerify: isHQ || (hqGate && role === "sales_staff"),
    canFinanceVerify: isHQ || (hqGate && role === "finance"),
    canVerifyPayment: isHQ || (hqGate && role === "finance"),
    canApprove: isHQ || (hqGate && role === "manager"),
    canCreateDispatch: isHQ || isSourceBranch || (hqGate && role === "warehouse"),
    canVerifyGrnDiscrepancy: isHQ || (hqGate && (role === "warehouse" || role === "finance")),
    canSubmitPayment: isHQ || isOwnerBranch,
    canConfirmDelivery: isHQ || isOwnerBranch,
    canCreateGrn: isHQ || isOwnerBranch,
    canSubmitComplaint: isHQ || isOwnerBranch,
    canReject: isHQ || (hqGate && (role === "manager" || role === "sales_staff" || role === "finance")),
    canSeePayments: isHQ || seesEverything || role === "finance",
    canSeeDispatch: isHQ || seesEverything || role === "warehouse",
    canSeeGrn: isHQ || seesEverything || role === "warehouse" || role === "finance",
    canSeeComplaints: isHQ || seesEverything || role === "sales_staff",
  };
}