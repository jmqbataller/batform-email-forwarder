# BatMail

## Cloudflare connection for dnd.cspro.space

The current forwarding domain is `dnd.cspro.space`; `mail.batform.online` remains accepted as a legacy inbound domain.
Cloudflare does not support catch-all routing on subdomains. BatMail therefore provisions a literal routing rule for each generated alias.

1. Apply `20261005105026_cloudflare_routing_connection.sql` and deploy `supabase/functions/cloudflare-routing/index.ts` with JWT verification enabled.
2. Create a Cloudflare custom API token with **Zone / Zone / Read** and **Zone / Email Routing Rules / Edit**, scoped to **cspro.space** only.
3. Open the BatMail admin dashboard, enter the token under **Email routing**, and select **Connect Cloudflare**. The token and discovered zone ID are stored encrypted in Supabase Vault, never in GitHub or browser-visible responses.
4. The connection form syncs existing active aliases in batches. Review all reported failures; a stored alias is not necessarily a routed alias.
5. Creating or renaming an alias calls the routing function before reporting readiness. Enabling an alias also ensures its route exists. Deletion removes only rules managed by this integration. Admins can retry failed provisioning with **Sync existing aliases**.

Cloudflare routing rule quotas still apply. If the quota is reached, provisioning reports a failure; request a higher quota or move to an apex-domain catch-all setup before growing beyond it.
Only admins can configure the token or sync all customers. Individual users may provision only their own aliases. The credential setter RPC is service-role-only.

Run the mocked provider and authorization checks with `node scripts/test-cloudflare-routing.mjs`.

BatMail is a private email-alias service for `batform.online`. It generates
random addresses at `mail.batform.online`, forwards their messages to the
owner's verified inbox, and relays replies without exposing that inbox address
to the original sender.

## Architecture

- **Next.js on Vercel** — public site, authentication, and alias dashboard
- **Supabase** — Auth, Postgres, Row Level Security, Vault, and the routing API
- **Cloudflare** — authoritative DNS and unlimited inbound Email Routing
- **Resend** — low-volume masked delivery to the owner inbox and reply relay
- **Spaceship** — domain registrar for `batform.online`

The email-processing path is independent of Vercel:

```text
sender -> random@mail.batform.online -> Cloudflare Email Worker
                                          |
                                          v
                                  Supabase routing API
                                          |
                               alias lookup + reply token
                                          |
                                          v
                               Resend -> owner inbox

owner reply -> reply-token@mail.batform.online -> Cloudflare Worker
                                                   |
                                                   v
                                         Supabase + Resend -> sender
```

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the public Supabase values.
3. Apply the files in `supabase/migrations` in order to a Supabase project.
4. Deploy `supabase/functions/cloudflare-inbound/index.ts` as an Edge Function
   with JWT verification disabled. It authenticates every Worker request with
   the shared secret stored in Supabase Vault.
5. Install and validate the Cloudflare Worker with `cd cloudflare && npm install
   && npm run check && npm test`.
6. Start the app with `npm run dev`.

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

Migration `007_cloudflare_worker_secret.sql` creates a random
`batmail_cloudflare_worker_secret` in Vault. Set the same value as the
Cloudflare Worker secret named `BATMAIL_WORKER_SECRET`.

The Edge Functions read secrets through a service-role-only database function.
The production Cloudflare routing API is:

```text
https://PROJECT_REF.supabase.co/functions/v1/cloudflare-inbound
```

The legacy `resend-inbound` function can remain deployed as a rollback path
during the DNS transition.

Deploy `cloudflare-inbound` with JWT verification disabled. In
**Authentication → URL Configuration**, set the Site URL to the production
web address and allow `/auth/callback` as a redirect URL.

### Vercel

Import this repository as a Next.js project. The production-safe public values
are in `.env.production`; no Supabase service key or Resend secret is required
by Vercel. Add `aliases.batform.online` to the project, then point the
`aliases` DNS host to the value Vercel provides.

### Cloudflare Email Routing

1. Add `batform.online` to Cloudflare and replace the registrar nameservers with
   the assigned Cloudflare nameservers. Preserve the existing `aliases` CNAME
   for Vercel.
2. Enable Email Routing for the `mail.batform.online` subdomain and let
   Cloudflare create its MX, SPF, and DKIM records.
3. Add and verify the owner's destination inbox in Cloudflare Email Routing.
4. From `cloudflare/`, set `BATMAIL_WORKER_SECRET` with `wrangler secret put`,
   then deploy with `npm run deploy`.
5. Subdomains require literal Email Routing rules whose action is the
   `batform-email-forwarder` Worker. Use the automatic connection above for
   the current `dnd.cspro.space` domain.

Keep the Resend API key in Supabase Vault. Cloudflare receives ordinary inbound
mail, while Resend delivers the masked copy to the owner inbox and relays replies.
Do not remove the Resend sending records; they authenticate the masked delivery.

Resend Free is limited to 100 emails per UTC day. BatMail uses strict masking:
if that quota is exhausted, the message remains available in the BatMail inbox
but is not copied to the owner inbox. Delivery resumes after the provider quota
resets. BatMail never falls back to forwarding the original message because that
would expose the original sender (for example, Canva) in Gmail.

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
- Resend and Worker secrets are encrypted in Supabase Vault and readable only by the service role.
- Cloudflare-to-Supabase requests require a constant-time checked 256-bit shared secret.
- Stable 20-character reply tokens are scoped to one alias/sender pair.
- Reply relay accepts mail only from the alias owner's exact destination address.
- Provider message IDs make webhook retries idempotent.
- Secrets and the private destination address are not committed to this repository.

## Limitation

BatMail masks email addresses and headers; it does not rewrite third-party message
content. A sender name, logo, link, tracking element, or footer inside the email
body can still identify the website that sent the message.

<!-- deployment refresh after Git reconnect: 2026-09-30 -->
