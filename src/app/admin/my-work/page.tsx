import MyWorkReferencePage, { dynamic } from "../my-work-reference/page";
import { InPageWorkspace } from "@/components/guided/in-page-workspace";

export { dynamic };

/**
 * Testing dashboard: screenshot-style staff dashboard on /admin/my-work.
 * Internal dashboard cards/links open inside the same fixed workspace so
 * the dashboard behind them does not move or require page scrolling.
 *
 * No database change. Testing branch only.
 */
export default async function MyWorkPage() {
  const dashboard = await MyWorkReferencePage();
  return <InPageWorkspace>{dashboard}</InPageWorkspace>;
}
