import { MachineryQueue } from "../queue-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <MachineryQueue queues={["kaam_darj_karna"]} title="mq_title_work" />;
}
