import MyWorkReferencePage, { dynamic } from "../my-work-reference/page";

export { dynamic };

/**
 * Testing dashboard: use the approved screenshot-style staff dashboard
 * directly on /admin/my-work so staff see the reference design on their
 * normal landing route. The reference page keeps existing permissions,
 * real needs-attention counts, recent activity and current ERP routes.
 *
 * No database change. Testing branch only.
 */
export default MyWorkReferencePage;
