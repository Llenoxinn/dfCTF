# Google and GitHub sign-in

The site already implements both providers. The buttons become usable when both
credentials for a provider are configured. A button becoming enabled does not
verify the provider's callback settings or complete a sign-in test.

## Current public deployment

Use `APP_URL=https://dfctf.vercel.app` with these exact callback URLs:

| Provider | Authorized callback |
| --- | --- |
| Google | `https://dfctf.vercel.app/api/auth/callback/google` |
| GitHub | `https://dfctf.vercel.app/api/auth/callback/github` |

In Google Cloud Console, select the project and open **Google Auth Platform →
Clients**. Edit the **Web application** client whose client ID is stored in
Vercel, add the Google callback under **Authorized redirect URIs**, and save.
Adding it only under **Authorized JavaScript origins** does not register a
callback. Do not add a trailing slash or use a preview hostname.

Configure the consent screen's app name and contact details. Use
`https://dfctf.vercel.app/privacy` for the privacy notice. Check the app's
audience/publishing settings; an app in Testing may require test users.

In GitHub **Settings → Developer settings → OAuth Apps**, edit the matching app.
Use `https://dfctf.vercel.app` for its homepage and the GitHub callback above for
its **Authorization callback URL**. Keep a separate OAuth app for local testing.

## Deployment credentials

In Vercel **Project → Settings → Environment Variables**, put the variable name
in **Key / Name** and the actual credential in **Value**:

| Key / Name | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google web client ID |
| `GOOGLE_CLIENT_SECRET` | Secret belonging to that Google client |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Secret belonging to that GitHub app |

Select the environment serving the stable public hostname. Save and redeploy
after changing Vercel variables. A provider dashboard-only callback correction
does not need an application code change. Keep credentials server-only and out of
Git, screenshots, and support messages.

From a trusted checkout, `npm run auth:check` prints the callback URLs derived
from `APP_URL` and reports whether each credential pair is present without
printing the credentials. It loads local environment files; to check deployment
configuration, explicitly supply that environment to the command. It does not
inspect or modify Google/GitHub dashboard settings.

## Verify the complete flow

1. Open the stable public hostname and use **Continue with Google**. Finish the
   provider flow and verify that the same account returns to dfCTF. Repeat with
   GitHub and sign out between trials.
2. Test a new account and existing linked account, email verification, provider
   cancellation, and return to a selected challenge or leaderboard.
3. Existing email/password accounts must sign in with their current method and
   explicitly connect a provider in **Settings**. Matching emails do not merge
   accounts automatically.
4. If Google shows `Error 400: redirect_uri_mismatch`, register the exact
   `redirect_uri` displayed in its error details on the client used by the app.
   Changing the client secret, disabling origin checks, or changing the callback
   code does not repair a missing provider registration.

Provider configuration requires access to the owning Google/GitHub account.
An enabled button or arrival at the provider's sign-in page alone does not
validate credential exchange, account linking, or the return callback.
