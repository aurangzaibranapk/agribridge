import type { PendingItem } from "./categories";
import type { ProductPendingExtra } from "./product-diff";

/** Detail safha (Kholein) -- mockup detail.png / merge.png. */
export function productDetailHref(category: string, id: string): string | null {
  if (category === "product_edits") return `/admin/my-work/pending/product/edit/${id}`;
  if (category === "product_merge") return `/admin/my-work/pending/product/merge/${id}`;
  return null;
}

/** Items par pehle-vs-baad lagana; self-merge par Approve band. */
export function attachProductExtras(items: PendingItem[], extras: Map<string, ProductPendingExtra>): PendingItem[] {
  return items.map((i) => {
    const href = productDetailHref(i.category, i.item_id);
    if (!href) return i;
    const extra = extras.get(i.item_id);
    return {
      ...i,
      link: href,
      ...(extra ? { product_extra: extra } : {}),
      ...(extra?.kind === "merge" && extra.flags.includes("self_merge") ? { block_approve: true } : {}),
    };
  });
}
