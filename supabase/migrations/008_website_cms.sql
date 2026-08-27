-- =====================================================================
-- AgriBridge — Migration 008: Website CMS (Phase "v.2 — Dynamic Website")
-- =====================================================================
-- Everything a content-managed enterprise website needs BEFORE the full
-- ERP comes back: blog, testimonials, gallery, FAQ, contact/investor
-- inquiry intake, newsletter, hero slider, site-wide settings, menus,
-- and editable static legal pages. All additive — nothing here touches
-- the existing profiles/RBAC/products/companies/categories tables
-- already live from earlier migrations.

-- ---------------------------------------------------------------------
-- BLOG
-- ---------------------------------------------------------------------
create table blog_posts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  featured_image_url text,
  category text,
  author_id uuid references auth.users(id),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_blog_posts_slug on blog_posts(slug);
create index idx_blog_posts_published on blog_posts(is_published, published_at);

-- ---------------------------------------------------------------------
-- TESTIMONIALS
-- ---------------------------------------------------------------------
create table testimonials (
  id uuid primary key default uuid_generate_v4(),
  customer_name text not null,
  location text,
  quote text not null,
  rating int check (rating between 1 and 5) default 5,
  image_url text,
  is_published boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- GALLERY
-- ---------------------------------------------------------------------
create type gallery_item_type as enum ('photo', 'video');

create table gallery_items (
  id uuid primary key default uuid_generate_v4(),
  type gallery_item_type not null default 'photo',
  url text not null,
  thumbnail_url text,
  caption text,
  category text,
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------
create table faqs (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  answer text not null,
  category text default 'General',
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CONTACT & INVESTOR INQUIRY INTAKE
-- ---------------------------------------------------------------------
create type inquiry_status as enum ('new', 'read', 'responded', 'closed');

create table contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  message text not null,
  status inquiry_status not null default 'new',
  created_at timestamptz not null default now()
);

-- Pre-ERP investor interest capture — distinct from the `investors` /
-- `investment_deals` tables (Migration 002b), which track an investor
-- once staff have actually onboarded them. This table is simply "someone
-- filled in the inquiry form," before any of that exists.
create table investor_inquiries (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  interest_type text, -- e.g. 'product_investment', 'corporation_deal', 'dairy_investment', 'franchise', 'other'
  message text,
  status inquiry_status not null default 'new',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- NEWSLETTER
-- ---------------------------------------------------------------------
create table newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  is_active boolean not null default true,
  subscribed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- HOMEPAGE HERO SLIDER
-- ---------------------------------------------------------------------
create table hero_slides (
  id uuid primary key default uuid_generate_v4(),
  image_url text not null,
  headline text not null,
  subheadline text,
  cta_label text,
  cta_url text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SITE-WIDE SETTINGS (key/value — same pattern as platform_settings)
-- ---------------------------------------------------------------------
create table website_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into website_settings (key, value) values
  ('site_name', '"Al Rana Traders — AgriBridge"'),
  ('contact_email', '"info@alranatraders.pk"'),
  ('contact_phone', '"+923226275476"'),
  ('contact_address', '"Pakistan"'),
  ('business_hours', '"Monday – Saturday: 7AM – 7PM"'),
  ('google_maps_embed_url', '""'),
  ('seo_default_title', '"Al Rana Traders — AgriBridge"'),
  ('seo_default_description', '"Pakistan''s trusted agriculture bridge — connecting farmers, dealers, and investors."'),
  ('stats_cities_served', '"75+"'),
  ('stats_partner_brands', '"40+"'),
  ('stats_years_of_trust', '"15+"')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- MENUS (header/footer navigation, staff-editable)
-- ---------------------------------------------------------------------
create table menu_items (
  id uuid primary key default uuid_generate_v4(),
  menu_location text not null, -- 'header' | 'footer'
  label text not null,
  url text not null,
  parent_id uuid references menu_items(id) on delete cascade,
  display_order int not null default 0,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------
-- STATIC LEGAL PAGES (editable from admin, not hardcoded in the app)
-- ---------------------------------------------------------------------
create table static_pages (
  slug text primary key,
  title text not null,
  content text not null,
  updated_at timestamptz not null default now()
);

insert into static_pages (slug, title, content) values
  ('privacy-policy', 'Privacy Policy', 'This policy explains how Al Rana Traders collects, uses, and protects your information. Full content to be finalised by staff in the Admin Panel.'),
  ('terms-and-conditions', 'Terms & Conditions', 'These terms govern your use of the Al Rana Traders / AgriBridge platform. Full content to be finalised by staff in the Admin Panel.'),
  ('cookie-policy', 'Cookie Policy', 'This policy explains how cookies are used on this website. Full content to be finalised by staff in the Admin Panel.'),
  ('refund-policy', 'Refund Policy', 'This policy explains the terms under which refunds are processed. Full content to be finalised by staff in the Admin Panel.'),
  ('disclaimer', 'Disclaimer', 'This disclaimer covers the limits of liability for information provided on this website. Full content to be finalised by staff in the Admin Panel.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- MEDIA LIBRARY (lightweight tracker over Supabase Storage uploads)
-- ---------------------------------------------------------------------
create table media_library (
  id uuid primary key default uuid_generate_v4(),
  file_url text not null,
  file_name text not null,
  file_type text, -- mime type
  file_size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Storage bucket for all CMS-uploaded media (hero images, blog images,
-- gallery photos/videos, testimonial photos) — separate from the
-- ai-crop-doctor/products/delivery-proof buckets already in use.
insert into storage.buckets (id, name, public) values ('website-media', 'website-media', true) on conflict (id) do nothing;

create policy "authenticated uploads website-media" on storage.objects for insert
  with check (bucket_id = 'website-media' and auth.role() = 'authenticated');
create policy "public read website-media" on storage.objects for select
  using (bucket_id = 'website-media');

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table blog_posts enable row level security;
alter table testimonials enable row level security;
alter table gallery_items enable row level security;
alter table faqs enable row level security;
alter table contact_messages enable row level security;
alter table investor_inquiries enable row level security;
alter table newsletter_subscribers enable row level security;
alter table hero_slides enable row level security;
alter table website_settings enable row level security;
alter table menu_items enable row level security;
alter table static_pages enable row level security;
alter table media_library enable row level security;

-- Staff manage everything (same repeated pattern used throughout this schema)
do $$
declare t text;
begin
  for t in select unnest(array[
    'blog_posts','testimonials','gallery_items','faqs','contact_messages',
    'investor_inquiries','newsletter_subscribers','hero_slides',
    'website_settings','menu_items','static_pages','media_library'
  ])
  loop
    execute format('create policy staff_all_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
    );', t);
  end loop;
end $$;

-- Public (anonymous) read access to genuinely public content only
create policy public_read_blog_posts on blog_posts for select using (is_published = true);
create policy public_read_testimonials on testimonials for select using (is_published = true);
create policy public_read_gallery on gallery_items for select using (is_published = true);
create policy public_read_faqs on faqs for select using (is_published = true);
create policy public_read_hero_slides on hero_slides for select using (is_active = true);
create policy public_read_website_settings on website_settings for select using (true);
create policy public_read_menu_items on menu_items for select using (is_active = true);
create policy public_read_static_pages on static_pages for select using (true);

-- Public (anonymous) INSERT-only on the intake forms — anyone can submit
-- a contact message, investor inquiry, or newsletter signup, but only
-- staff can ever read them back (no policy grants anonymous select here).
create policy public_submit_contact_message on contact_messages for insert with check (true);
create policy public_submit_investor_inquiry on investor_inquiries for insert with check (true);
create policy public_subscribe_newsletter on newsletter_subscribers for insert with check (true);
