# Support issue assignment

Internal staff assignment works without an external service: an Owner/Admin chooses an active profile and the assignee receives an in-app notification.

External coding agents are shown only when a secure webhook is configured. This avoids displaying ChatGPT, Grok, Claude, or another agent as “connected” when it cannot actually receive work.

```env
SUPPORT_AGENT_REPOSITORY=aurangzaibranapk/agribridge
SUPPORT_AGENT_CALLBACK_SECRET=replace-with-a-long-random-secret
SUPPORT_AGENT_ROUTES=[{"key":"codex","label":"ChatGPT / Codex","url":"https://agent.example.com/agribridge/support","token":"agent-webhook-token"}]
```

The configured webhook receives `support.ticket.assigned`, the ticket details, screenshot signed URL, repository, and callback instructions. It should return optional JSON `{ "taskId": "...", "message": "..." }`.

Progress is posted to the supplied callback URL with the bearer token:

```json
{
  "taskId": "external-task-id",
  "status": "working",
  "message": "Issue reproduce ho gaya; fix tayar ho raha hai."
}
```

Allowed callback statuses are `working`, `blocked`, `testing`, `completed`, and `failed`. A completed agent fix moves the issue to **Testing**; an Admin/Owner marks it **Resolved** after verification.
