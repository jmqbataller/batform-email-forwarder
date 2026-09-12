# BatMail

BatMail is a private email alias and forwarding service for `batforum.online`.
It creates random addresses at `mail.batforum.online`, forwards messages to a
verified Supabase account email, and creates a stable random reply address for
every alias/sender pair. Replies are relayed to the original sender without
placing the user's real inbox address in the outgoing email headers.

## Architecture

- **Next.js on Vercel** — website, authenticated dashboard, server actions, and inbound webhook
- **Supabase** — Auth, Postgres, Row Level Security, aliases, reply mappings, and delivery activity
- **Resend** — inbound MX handling, webhook delivery, message retrieval, DKIM signing, and outgoing relay
- **Spaceship** — registrar and DNS manager for `batforum.online`

Incoming mail uses a subdomain so the root domain remains available for the
website and any future mailbox provider.

```text
Website/app -> random@mail.batforum.online -> Resend Inbound
                                               |
                                               v
                                         Vercel webhook
                                               |
                                   Supabase alias lookup
                                               |
                                               v
                                           Gmail inbox

Gmail reply -> reverse-token@mail.batforum.online -> webhook -> original sender
```

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add the credentials from Supabase and Resend.

3. In Supabase SQL Editor, run:

   ```text
   supabase/migrations/001_initial_schema.sql
   ```

4. Create the first user in Supabase under **Authentication → Users**. Keep
   `NEXT_PUBLIC_ALLOW_SIGNUPS=false` for a private service.

5. Start the app:

   ```bash
   npm run dev
   ```

## Production setup

### Supabase

1. Create a project and run the migration.
2. Copy the project URL, publishable key, and secret key to Vercel environment variables.
3. Under **Authentication → URL Configuration**, set:
   - Site URL: `https://aliases.batforum.online`
   - Redirect URL: `https://aliases.batforum.online/auth/callback`
4. For the initial private account, set `NEXT_PUBLIC_ALLOW_SIGNUPS=true` and
   `SIGNUP_ALLOWED_EMAIL` to the owner's exact inbox. This allows only that
   address to register. Set `NEXT_PUBLIC_ALLOW_SIGNUPS=false` after activation.

The secret key is used only by the server webhook. The browser and dashboard
use the publishable key with Row Level Security.

### Vercel

1. Import the GitHub repository as a Next.js project.
2. Add every variable from `.env.example`.
3. Add `aliases.batforum.online` in the project Domains page. The root domain remains available for the existing BATFORM website.
4. Redeploy after all variables are saved.

### Resend

1. Add `mail.batforum.online` as a domain.
2. Add the DKIM/SPF records shown by Resend in Spaceship.
3. Enable **Receiving** and copy the exact MX record shown by Resend.
4. Add a webhook for:

   ```text
   https://aliases.batforum.online/api/webhooks/resend
   ```

5. Select the `email.received` event and copy its signing secret to
   `RESEND_WEBHOOK_SECRET` in Vercel.
6. Use a full-access Resend API key because the webhook retrieves inbound bodies
   and attachments and sends forwarded messages.

### Spaceship DNS

Use the exact values shown in the Vercel and Resend dashboards. The expected
record layout is:

| Host | Type | Purpose |
| --- | --- | --- |
| `aliases` | CNAME | Vercel BatMail website |
| `mail` | MX | Resend inbound receiving |
| Resend-provided host | TXT | SPF authorization |
| Resend-provided DKIM host | TXT | DKIM signing |
| `_dmarc.mail` | TXT | DMARC policy and reports |

Do not guess the Vercel or Resend record values; copy the values shown for this
project. Start DMARC in monitoring mode, then tighten the policy after delivery
has been tested.

## Verification checklist

1. Sign in and create an alias.
2. Send a message from another account to the new alias.
3. Confirm Gmail displays a random `@mail.batforum.online` sender and the message body/attachments arrive.
4. Reply from the exact destination inbox and confirm the original sender receives it from the public alias.
5. Pause the alias and confirm new messages are no longer forwarded.
6. In Gmail, use **Show original** and confirm SPF, DKIM, and DMARC pass for the BatMail domain.

## Security choices

- Webhook signatures are verified against the raw request body.
- Reply tokens use 20 characters and are scoped to one public alias and sender.
- A reverse alias accepts replies only from the alias owner's verified destination.
- Public aliases are 10 random characters and cannot be chosen by unauthenticated callers.
- The secret Supabase key and Resend key never enter the browser bundle.
- Every exposed user table has Row Level Security.
- Provider email IDs prevent webhook retries from forwarding a message twice.
- Signups are invite-only by default. When temporarily enabled, a server-only
  email allowlist restricts registration to the intended owner.

## Operational limitation

The forwarded email keeps the sender's original HTML and text, so a website name,
logo, links, or footer in the message body can still identify the source. BatMail
masks the visible sender address and the user's real mailbox; it does not rewrite
the content of third-party messages.
