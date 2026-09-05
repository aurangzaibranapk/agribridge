import { MachineryQueue } from "../queue-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <MachineryQueue queues={["bill_banana", "paisa_lena"]} title="mq_title_billing" />;
}
