# BatMail

BatMail is a private email-alias service for `batform.online`. It generates
random addresses at `mail.batform.online`, forwards their messages to the
owner's verified inbox, and relays replies without exposing that inbox address
to the original sender.

## Architecture

- **Next.js on Vercel** — public site, authentication, and alias dashboard
- **Supabase** — Auth, Postgres, Row Level Security, Vault, and the inbound Edge Function
- **Resend** — inbound MX handling, signed webhooks, message retrieval, and delivery
- **Spaceship** — DNS for `batform.online`

The email-processing path is independent of Vercel:

```text
sender -> random@mail.batform.online -> Resend Inbound
                                          |
                                          v
                                  Supabase Edge Function
                                          |
                               alias lookup + reply token
                                          |
                                          v
                                      owner inbox

owner reply -> reply-token@mail.batform.online -> Edge Function -> sender
```

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the public Supabase values.
3. Apply the files in `supabase/migrations` in order to a Supabase project.
4. Deploy `supabase/functions/resend-inbound/index.ts` as an Edge Function with
   JWT verification disabled. The function verifies Resend's Svix signature
   itself.
5. Start the app with `npm run dev`.

## Production configuration

### Supabase

The deployed database contains a private account allowlist. Add the owner there;
do not put the address in source code:

```sql
insert into private.allowed_accounts (email)
values ('owner@example.com')
on conflict do nothing;
```

Store the Resend credentials in Supabase Vault using these names:

- `batmail_resend_api_key`
- `batmail_resend_webhook_secret`

The Edge Function reads them through a service-role-only database function.
Its public URL is:

```text
https://PROJECT_REF.supabase.co/functions/v1/resend-inbound
```

In **Authentication → URL Configuration**, set the Site URL to the production
web address and allow `/auth/callback` as a redirect URL.

### Vercel

Import this repository as a Next.js project. The production-safe public values
are in `.env.production`; no Supabase service key or Resend secret is required
by Vercel. Add `aliases.batform.online` to the project, then point the
`aliases` DNS host to the value Vercel provides.

### Resend and Spaceship DNS

Add `mail.batform.online` in Resend, enable receiving, and subscribe a webhook
to `email.received` at the Supabase Edge Function URL. In Spaceship, add the
exact DKIM, sending SPF, return-path, and receiving MX records issued by Resend.
Do not reuse the root domain's MX records.

## Verification

1. Register the allowlisted owner, sign in, and create an alias.
2. Send a message from a different account to that alias.
3. Confirm the protected inbox sees a random `@mail.batform.online` sender and
   receives the original body and attachments.
4. Reply from the exact protected inbox and confirm the original sender receives
   it from the public alias.
5. Pause the alias and confirm new messages are no longer forwarded.
6. In Gmail's **Show original**, confirm SPF, DKIM, and DMARC pass.

## Security properties

- The browser receives only Supabase's publishable key; RLS protects user data.
- Only the allowlisted account can create or change aliases.
- Resend secrets are encrypted in Supabase Vault and readable only by the service role.
- Webhook signatures are checked against the unmodified request body.
- Stable 20-character reply tokens are scoped to one alias/sender pair.
- Reply relay accepts mail only from the alias owner's exact destination address.
- Provider message IDs make webhook retries idempotent.
- Secrets and the private destination address are not committed to this repository.

## Limitation

BatMail masks email addresses and headers; it does not rewrite third-party message
content. A sender name, logo, link, tracking element, or footer inside the email
body can still identify the website that sent the message.
