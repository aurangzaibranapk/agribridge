"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateBlogDraft, type GeneratedBlogDraft } from "@/lib/ai/blog-draft-client";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export interface AIDraftState {
  data?: GeneratedBlogDraft;
  notConfigured?: boolean;
  error?: string;
}

export async function generateBlogDraftAction(_prev: AIDraftState, formData: FormData): Promise<AIDraftState> {
  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic) return { error: "Please enter a topic first." };

  const result = await generateBlogDraft(topic);
  if (!result) return { notConfigured: true };
  return { data: result };
}

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------
// BLOG
// ---------------------------------------------------------------------
export async function saveBlogPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = formData.get("id") as string | null;
  const title = String(formData.get("title"));
  const isPublished = formData.get("is_published") === "on";

  const payload = {
    title,
    slug: slugify(title),
    excerpt: (formData.get("excerpt") as string) || null,
    content: String(formData.get("content")),
    featured_image_url: (formData.get("featured_image_url") as string) || null,
    category: (formData.get("category") as string) || null,
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("blog_posts").update(payload).eq("id", id)
    : await supabase.from("blog_posts").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  redirect("/admin/blog");
}

export async function deleteBlogPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { success: true };
}

// ---------------------------------------------------------------------
// TESTIMONIALS
// ---------------------------------------------------------------------
export async function saveTestimonial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = formData.get("id") as string | null;
  const payload = {
    customer_name: String(formData.get("customer_name")),
    location: (formData.get("location") as string) || null,
    quote: String(formData.get("quote")),
    rating: Number(formData.get("rating") ?? 5),
    image_url: (formData.get("image_url") as string) || null,
    is_published: formData.get("is_published") === "on",
    display_order: Number(formData.get("display_order") ?? 0),
  };
  const { error } = id
    ? await supabase.from("testimonials").update(payload).eq("id", id)
    : await supabase.from("testimonials").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  revalidatePath("/testimonials");
  return { success: true };
}

export async function deleteTestimonial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/testimonials");
  revalidatePath("/testimonials");
  return { success: true };
}

// ---------------------------------------------------------------------
// GALLERY
// ---------------------------------------------------------------------
export async function saveGalleryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const payload = {
    type: String(formData.get("type") ?? "photo"),
    url: String(formData.get("url")),
    thumbnail_url: (formData.get("thumbnail_url") as string) || null,
    caption: (formData.get("caption") as string) || null,
    category: (formData.get("category") as string) || null,
    display_order: Number(formData.get("display_order") ?? 0),
    is_published: true,
  };
  const { error } = await supabase.from("gallery_items").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

export async function deleteGalleryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("gallery_items").delete().eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

// ---------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------
export async function saveFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = formData.get("id") as string | null;
  const payload = {
    question: String(formData.get("question")),
    answer: String(formData.get("answer")),
    category: (formData.get("category") as string) || "General",
    display_order: Number(formData.get("display_order") ?? 0),
    is_published: formData.get("is_published") === "on",
  };
  const { error } = id
    ? await supabase.from("faqs").update(payload).eq("id", id)
    : await supabase.from("faqs").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
  return { success: true };
}

export async function deleteFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("faqs").delete().eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
  return { success: true };
}

// ---------------------------------------------------------------------
// HERO SLIDES
// ---------------------------------------------------------------------
export async function saveHeroSlide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const payload = {
    image_url: String(formData.get("image_url")),
    mobile_image_url: (formData.get("mobile_image_url") as string) || null,
    headline: String(formData.get("headline")),
    subheadline: (formData.get("subheadline") as string) || null,
    cta_label: (formData.get("cta_label") as string) || null,
    cta_url: (formData.get("cta_url") as string) || null,
    display_order: Number(formData.get("display_order") ?? 0),
    is_active: true,
  };
  const { error } = await supabase.from("hero_slides").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/hero-slides");
  revalidatePath("/");
  return { success: true };
}

export async function updateHeroSlide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const payload = {
    image_url: String(formData.get("image_url")),
    mobile_image_url: (formData.get("mobile_image_url") as string) || null,
    headline: String(formData.get("headline")),
    subheadline: (formData.get("subheadline") as string) || null,
    cta_label: (formData.get("cta_label") as string) || null,
    cta_url: (formData.get("cta_url") as string) || null,
    display_order: Number(formData.get("display_order") ?? 0),
  };
  const { error } = await supabase.from("hero_slides").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/hero-slides");
  revalidatePath("/");
  return { success: true };
}

export async function deleteHeroSlide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("hero_slides").delete().eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/hero-slides");
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------
// WEBSITE SETTINGS (key/value)
// ---------------------------------------------------------------------
export async function updateWebsiteSetting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const key = String(formData.get("key"));
  const value = String(formData.get("value"));
  const { error } = await supabase.from("website_settings").update({ value: JSON.stringify(value), updated_at: new Date().toISOString() }).eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------
// STATIC PAGES
// ---------------------------------------------------------------------
export async function updateStaticPage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const slug = String(formData.get("slug"));
  const payload = {
    title: String(formData.get("title")),
    content: String(formData.get("content")),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("static_pages").update(payload).eq("slug", slug);
  if (error) return { error: error.message };
  revalidatePath("/admin/static-pages");
  revalidatePath(`/${slug}`);
  return { success: true };
}

// ---------------------------------------------------------------------
// MENUS
// ---------------------------------------------------------------------
export async function saveMenuItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const payload = {
    menu_location: String(formData.get("menu_location")),
    label: String(formData.get("label")),
    url: String(formData.get("url")),
    display_order: Number(formData.get("display_order") ?? 0),
    is_active: true,
  };
  const { error } = await supabase.from("menu_items").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/admin/menus");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteMenuItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/menus");
  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------
// CONTACT MESSAGES / INVESTOR INQUIRIES — status updates
// ---------------------------------------------------------------------
export async function updateContactMessageStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("contact_messages").update({ status: String(formData.get("status")) }).eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/contact-messages");
  return { success: true };
}

export async function updateInvestorInquiryStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("investor_inquiries").update({ status: String(formData.get("status")) }).eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/investor-inquiries");
  return { success: true };
}

// ---------------------------------------------------------------------
// FARMER APPROVAL
// ---------------------------------------------------------------------
export async function verifyFarmer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("farmers").update({ is_verified: true }).eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/farmers");
  return { success: true };
}