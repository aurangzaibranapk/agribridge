/** Notice khulne par read — pending faisla alag.  npm run test:notification-read */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isNotificationId,
  notificationIdsForOpen,
  notificationLinkMatches,
  type NoticeRef,
} from "../src/lib/notifications-read";

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log(`ok  ${name}`);
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";

function row(id: string, link: string | null, isRead = false): NoticeRef {
  return { id, link_url: link, is_read: isRead };
}

const rows: NoticeRef[] = [
  row(A, "/admin/my-work/pending?f=escalated"),
  row(B, "/admin/my-work/pending?f=escalated"),
  row(C, "/admin/load-bill"),
  row(D, "https://alranatraders.pk/admin/products"),
  row("55555555-5555-4555-8555-555555555555", "/admin/products", true),
];

test("escalated aur mine alag screens hain", () => {
  assert.equal(notificationLinkMatches("/admin/my-work/pending?f=escalated", "/admin/my-work/pending?f=mine"), false);
  assert.equal(notificationLinkMatches("/admin/my-work/pending?f=escalated", "/admin/my-work/pending"), false);
  assert.equal(notificationLinkMatches("/admin/my-work/pending?f=escalated", "/admin/my-work/pending?f=escalated&x=1"), true);
});

test("path exact hai, child route notice nahi kholta", () => {
  assert.equal(notificationLinkMatches("/admin/load-bill", "/admin/load-bill/"), true);
  assert.equal(notificationLinkMatches("/admin/load-bill", "/admin/load-bill/abc"), false);
  assert.equal(notificationLinkMatches("/admin/my-work", "/admin/my-work/pending"), false);
});

test("poora URL aur trailing slash ek hi screen", () => {
  assert.equal(notificationLinkMatches("https://alranatraders.pk/admin/products", "/admin/products"), true);
  assert.equal(notificationLinkMatches("/admin/products/", "/admin/products"), true);
});

test("ek escalation notice khulne par usi link wali saari unread, load-bill nahi", () => {
  const ids = notificationIdsForOpen(rows, { id: A, href: "/admin/my-work/pending?f=escalated" });
  assert.deepEqual(ids.sort(), [A, B].sort());
});

test("Open load-bill sirf us link ko read karta hai, escalated pending nahi", () => {
  const ids = notificationIdsForOpen(rows, { href: "/admin/load-bill" });
  assert.deepEqual(ids, [C]);
});

test("bina link sirf wohi id, aur parhi hui href se nahi chunti", () => {
  const ids = notificationIdsForOpen(rows, { id: C });
  assert.deepEqual(ids, [C]);
  const products = notificationIdsForOpen(rows, { href: "/admin/products" });
  assert.deepEqual(products, [D]);
});

test("khali / ghalat id kuch nahi maangti", () => {
  assert.equal(isNotificationId("nope"), false);
  assert.equal(isNotificationId(A), true);
  assert.deepEqual(notificationIdsForOpen(rows, { id: "nope", href: "/admin/no-such" }), []);
  assert.deepEqual(notificationIdsForOpen([], { href: "/admin/pos" }), []);
});

test("wiring: kholna is_read likhta hai, pending faisla nahi", () => {
  const action = readFileSync("src/actions/notifications.ts", "utf8");
  const bell = readFileSync("src/components/layout/notification-bell.tsx", "utf8");
  const list = readFileSync("src/components/pending/pending-bell-panel.tsx", "utf8");
  const open = readFileSync("src/app/admin/my-work/pending/decide-buttons.tsx", "utf8");
  const page = readFileSync("src/app/admin/notifications/notifications-client.tsx", "utf8");
  const toast = readFileSync("src/components/pending/pending-toast.tsx", "utf8");
  const link = readFileSync("src/components/notifications/mark-read.tsx", "utf8");

  assert.match(action, /\.from\("notifications"\)/);
  assert.match(action, /is_read: true/);
  assert.doesNotMatch(action, /decidePending|fn_admin_pending|admin_pending_seen/);

  assert.match(bell, /data-badge="unread"/);
  assert.match(bell, /data-badge="pending"|RedBadge/);
  assert.doesNotMatch(bell, /!\(pend\.enabled && pend\.totals\.pending > 0\)/);
  assert.match(bell, /MarkReadLink href=\{item\.link_url\}/);

  assert.match(list, /MarkReadLink/);
  assert.match(list, /href=\{i\.link \|\| i\.route\}/);
  assert.match(list, /<Link href=\{PENDING_PAGE\}/);

  assert.match(open, /MarkReadLink href=\{href\}/);
  assert.match(open, /decidePending/);
  assert.match(open, /Kholein sirf linked notification/);

  assert.match(page, /markOpened\(\{ id: notification\.id/);
  assert.doesNotMatch(page, /<Link href=\{notification\.link_url\}/);

  assert.match(toast, /MarkReadLink href=\{href\}/);
  assert.match(link, /bellItem,/);
  assert.match(link, /markNotificationOpened/);
  assert.doesNotMatch(link, /decidePending|fn_admin_pending/);
});

console.log(`\n${n} tests passed`);
