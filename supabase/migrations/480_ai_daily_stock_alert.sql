-- Migration 480: AI Daily Stock Alert via pg_cron
-- Har raat 9 baje (PKT = UTC+5, 16:00 UTC) auto stock check chalega
-- aur v_reorder_suggestions se urgent items bridge_ai_notifications mein
-- store karega.
--
-- NOTE: pg_cron Supabase Pro plan feature hai. Testing par cron extension
-- enable hona chahiye; Live par bhi Pro plan ke sath available hai.
-- Agar cron extension nahi hai, is migration ko skip karo aur sirf
-- ensure_bridge_ai_notifications_table() wali DDL chalao.

-- ===== Step 1: Notifications table (agar nahi hai) =====
CREATE TABLE IF NOT EXISTS bridge_ai_notifications (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text         NOT NULL,   -- 'stock_alert', 'demand_alert', waghera
  title       text         NOT NULL,
  body        jsonb        NOT NULL DEFAULT '{}',
  is_read     boolean      NOT NULL DEFAULT false,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- Index for unread fetch
CREATE INDEX IF NOT EXISTS idx_bridge_ai_notif_unread
  ON bridge_ai_notifications (created_at DESC)
  WHERE is_read = false;

-- RLS: sirf admin/owner/manager dekh sakta hai
ALTER TABLE bridge_ai_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bridge_ai_notif_admin_read" ON bridge_ai_notifications;
CREATE POLICY "bridge_ai_notif_admin_read" ON bridge_ai_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'super_admin', 'admin', 'finance', 'manager')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "bridge_ai_notif_service_insert" ON bridge_ai_notifications;
CREATE POLICY "bridge_ai_notif_service_insert" ON bridge_ai_notifications
  FOR INSERT WITH CHECK (true);  -- pg_cron/service role se insert hoga

-- ===== Step 2: Stock alert function =====
CREATE OR REPLACE FUNCTION fn_ai_daily_stock_alert()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  urgent_count  integer;
  alert_body    jsonb;
BEGIN
  -- v_reorder_suggestions se urgent items collect karo
  SELECT
    count(*),
    jsonb_agg(
      jsonb_build_object(
        'product', product_name,
        'on_hand', on_hand,
        'daily_rate', ROUND(daily_rate::numeric, 2),
        'days_left', ROUND((on_hand / NULLIF(daily_rate, 0))::numeric, 1),
        'reorder_qty', reorder_qty,
        'estimated_cost', estimated_cost
      )
      ORDER BY (on_hand / NULLIF(daily_rate, 0)) ASC NULLS LAST
    )
  INTO urgent_count, alert_body
  FROM v_reorder_suggestions
  WHERE on_hand < (daily_rate * 3);   -- 3 din se kam bacha

  IF urgent_count IS NULL OR urgent_count = 0 THEN
    RETURN;  -- kuch urgent nahi, notification mat banao
  END IF;

  INSERT INTO bridge_ai_notifications (type, title, body)
  VALUES (
    'stock_alert',
    urgent_count || ' products sirf 3 din ka stock bacha hai',
    jsonb_build_object(
      'urgent_count', urgent_count,
      'items', alert_body,
      'generated_at', now()
    )
  );
END;
$$;

-- ===== Step 3: pg_cron schedule (har raat 9 PM PKT = 16:00 UTC) =====
-- NOTE: pg_cron extension zaroor enable honi chahiye.
-- Testing par: Supabase Dashboard → Database → Extensions → pg_cron ON karo.
-- Agar extension nahi hai, ye block silently fail hoga — table aur function
-- phir bhi ban jayenge, sirf auto-schedule nahi hogi.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- pehla schedule hata do (idempotent)
    PERFORM cron.unschedule('ai-daily-stock-alert')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'ai-daily-stock-alert'
    );

    PERFORM cron.schedule(
      'ai-daily-stock-alert',
      '0 16 * * *',   -- 16:00 UTC = 21:00 PKT
      $$SELECT fn_ai_daily_stock_alert()$$
    );

    RAISE NOTICE 'pg_cron: ai-daily-stock-alert schedule set (16:00 UTC daily).';
  ELSE
    RAISE NOTICE 'pg_cron extension nahi mili — manual ya cron job se chalayein: SELECT fn_ai_daily_stock_alert();';
  END IF;
END;
$$;
