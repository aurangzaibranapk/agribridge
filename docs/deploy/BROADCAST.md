# Announcements / Broadcast: setup (not live yet)

Migrations **589, 594, 597, 598, 599** are files only and must be applied with owner approval, after a backup.
Nothing is sent until **`BROADCAST_ENABLED=true`**.

## .env (set later via Secure Form; never paste in chat)
| Var | Default | Meaning |
|---|---|---|
| `BROADCAST_ENABLED` | (unset = OFF) | Kill switch. Only the exact value `true` allows sending. |
| `BROADCAST_CRON_SECRET` | none | Header `x-broadcast-secret` for `POST /api/broadcast/run` (cron every minute). |
| `BROADCAST_RATE_PER_SEC` | 20 (max 80) | Messages per second. |
| `BROADCAST_DAILY_CAP` | 1000 | Maximum messages per PKT day. |
| `BROADCAST_QUIET_HOURS` | `21-08` | No sending between these PKT hours; messages wait until morning. |
| `SMS_PROVIDER` | `console` | Only `console` exists (writes to the log, sends nothing). Real gateway adapter later. |
| `SMS_RATE_PER_SEGMENT_USD` | (unset) | SMS cost per segment; unset means "provider rates TBD". |
| `META_RATE_MARKETING_USD` | 0.0473 | Meta Pakistan, per delivered MARKETING message (effective 1 Oct 2026). |
| `META_RATE_UTILITY_USD` | 0.0150 | Meta Pakistan, per delivered UTILITY message. |
| `META_RATE_EFFECTIVE` | 2026-10-01 | Date shown on the estimate. |

The existing `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_APP_SECRET` are reused. Delivery status and STOP are recorded only for signed webhooks.

## Flow
1. Draft
2. Send for approval (the audience is frozen at this point; STOP/DND numbers removed)
3. Owner or admin, **not the creator**, approves (enforced in the database)
4. Worker sends within the rate limit, outside quiet hours
5. Delivery report

WhatsApp messages go only through Meta-**APPROVED** templates, registered under Broadcast → Templates. The status there is entered by hand until template sync is added.
