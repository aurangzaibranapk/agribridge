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

  return {
    role,
    isOwnerBranch,
    isSourceBranch,
    canSalesVerify: hqGate && (isHQ || role === "sales_staff"),
    canFinanceVerify: hqGate && (isHQ || role === "finance"),
    canVerifyPayment: hqGate && (isHQ || role === "finance"),
    canApprove: hqGate && (isHQ || role === "manager"),
    canCreateDispatch: isSourceBranch || (hqGate && (isHQ || role === "warehouse")),
    canVerifyGrnDiscrepancy: hqGate && (isHQ || role === "warehouse" || role === "finance"),
    canSubmitPayment: isOwnerBranch,
    canConfirmDelivery: isOwnerBranch,
    canCreateGrn: isOwnerBranch,
    canSubmitComplaint: isOwnerBranch,
    canReject: hqGate && (isHQ || role === "manager" || role === "sales_staff" || role === "finance"),
    canSeePayments: seesEverything || role === "finance",
    canSeeDispatch: seesEverything || role === "warehouse",
    canSeeGrn: seesEverything || role === "warehouse" || role === "finance",
    canSeeComplaints: seesEverything || role === "sales_staff",
  };
}