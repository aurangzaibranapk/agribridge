# Support issue assignment

AgriBridge now supports a professional, approval-gated support workflow for internal staff and ChatGPT/Codex.

## Workflow

1. Staff reports an issue with details, page URL, device information and an optional screenshot.
2. Owner/Admin assigns an internal developer or **ChatGPT / Codex (Subscription)**.
3. For subscription Codex, AgriBridge creates a private GitHub Issue containing the evidence and mandatory analysis protocol.
4. The agent explains:
   - what is wrong,
   - affected modules/users/data,
   - root cause and evidence,
   - risk,
   - proposed fix,
   - files/tests/migration/rollback impact.
5. The agent posts `[AGRIBRIDGE:APPROVAL_REQUIRED:ISS-...]` and stops.
6. Owner/Admin chooses **Fix Approve Karein** or **Changes Mangwain** in AgriBridge.
7. Only after approval may the agent report Working, Testing and Fixed.
8. The reporter and managers receive in-app notifications at every stage.
9. Owner/Admin verifies the fix and closes the ticket. Agents cannot merge or apply live migrations by themselves.

The support panel refreshes visible tickets every 15 seconds, so the reporter can follow progress without reopening the page.

## Subscription-only Codex setup

This route does not use an OpenAI API key. Codex work is started from the connected GitHub repository while signed in with the owner's ChatGPT/Codex subscription.

Add these secrets to the server environment:

```env
SUPPORT_AGENT_REPOSITORY=aurangzaibranapk/agribridge
SUPPORT_GITHUB_TOKEN=github-fine-grained-token
SUPPORT_GITHUB_WEBHOOK_SECRET=replace-with-a-long-random-secret
SUPPORT_AGENT_CALLBACK_SECRET=replace-with-a-different-long-random-secret
```

`SUPPORT_GITHUB_TOKEN` must be a fine-grained token restricted to this one private repository with:

- Metadata: Read
- Issues: Read and write
- Pull requests: Read

Never place the token in browser code, Git, screenshots, support comments or a `NEXT_PUBLIC_` variable.

In GitHub repository settings, create a webhook:

- Payload URL: `https://alranatraders.pk/api/support/github`
- Content type: `application/json`
- Secret: same value as `SUPPORT_GITHUB_WEBHOOK_SECRET`
- Events: **Issue comments** and **Pull requests**

After changing environment variables, restart the Node.js application.

## Ticket stages

| Stage | Meaning |
| --- | --- |
| Reported | Staff issue received |
| Analysis | Agent is diagnosing; code changes are forbidden |
| Approval Required | Root cause and proposed fix are ready |
| Approved | Owner/Admin allowed the proposed work |
| Working | Approved code change is in progress |
| Testing | Tests, TypeScript and production build are running |
| Fixed | Branch/PR and fix evidence are ready |
| Verified & Closed | Owner/Admin verified and closed the issue |

## Other webhook agents

Custom secure agents can still be configured:

```env
SUPPORT_AGENT_ROUTES=[{"key":"other_agent","label":"Other Agent","url":"https://agent.example.com/agribridge/support","token":"agent-webhook-token"}]
```

They receive `support.ticket.assigned`, ticket evidence, repository, approval-required workflow metadata and callback instructions. Callback statuses are `analysis`, `approval_required`, `working`, `blocked`, `testing`, `fixed`, `completed`, and `failed`. Work-stage callbacks are rejected until Owner/Admin approval.
