import { MachineryQueue } from "../queue-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <MachineryQueue queues={["machine_bhejna"]} title="mq_title_assign" />;
}
