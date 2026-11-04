# Private reporting intake

The shared footer opens one accessible dialog for general feedback, bug reports,
and feature suggestions. The public same-origin `POST /api/v1/feedback` endpoint
requires neither a dfCTF login nor a GitHub account. All variants use the same
validation, delivery, rate limits, and receipt handling. No public repository
forwarding is performed.

Before deployment, apply migration `0007_feedback_receipts` with `npm run db:migrate`.
Configure the existing `SMTP_URL`, `MAIL_FROM`, and `AUTH_SECRET`, and set
`FEEDBACK_TO` to the developer inbox (for example, `dfctf.dfc@gmail.com`). There
is no implicit destination: an unset `FEEDBACK_TO` fails safely and leaves the
form text available for retry. Confirm inbox ownership and verify real SMTP
delivery before release.

In development, `LOCAL_MAIL=1` uses the same local mailbox as login emails,
writing private JSON files beneath `.data/mail/` instead of sending SMTP mail.
`FEEDBACK_TO` is still required. The dialog explicitly identifies local storage
and does not claim that email was sent. Production never enables this mode.
The `SMTP_URL` and `MAIL_FROM` settings are required outside local-mail mode.

The original `{subject,message,email}` feedback request remains supported, with
120/5000/254 character limits. Its validation errors use those field names.
The shared dialog uses the structured request with a stable submission ID;
feedback uses the same limits, while bug/feature details retain their existing
limits. Unknown fields, empty required fields, and header line breaks are rejected.
Legacy requests receive a server-generated ID; callers that need retry
deduplication should use the structured protocol with a stable client ID.

All report details and optional reply contact go to that private inbox as plain
text. Never transfer contact details, secrets, flags, or private evidence to a
public issue. No SMTP or GitHub credentials are sent to clients.

Submission IDs prevent parallel/repeated sends. A receipt commits only when SMTP
accepts the message (or development local-mail storage succeeds); failure rolls
the transaction back and permits retry.
Receipts are RLS protected and contain only an ID, keyed content digest, and time.
The optional contact email is used as Reply-To, never as the sender address.
Five new submission attempts per proxy address per hour are allowed. Production
uses the hosting proxy's `X-Real-IP`; custom hosting must overwrite that header.

SMTP acceptance is not a guarantee of final mailbox delivery. Monitor provider
bounces. A process failure after SMTP acceptance but before receipt commit can
still cause duplicate mail on retry; use the submission ID in the email to
identify such duplicates. No exactly-once email guarantee is claimed.
