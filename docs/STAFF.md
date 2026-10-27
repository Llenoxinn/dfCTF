# Staff setup

Staff accounts write, review, and publish challenges. Because they can see flags and walkthroughs, they need a second sign-in step: a 6-digit code from an authenticator app on your phone. Players never need this.

You do steps 1 to 3 once. After that, signing in asks for the code automatically.

## 1. Get a staff role

1. Register on dfCTF, open the verification email, and choose a codename, exactly like a player.
2. Ask the maintainer to give your account a role. They run one of these commands on the server, with the app stopped when using the local database:

   | Role | Can do | Command |
   | --- | --- | --- |
   | Reviewer | Test-solve and publish other people's challenges | `npm run admin -- reviewer you@example.com` |
   | Administrator | Everything: write, review, host competitions, manage accounts | `npm run admin -- grant you@example.com` |

   On a Docker deployment, prefix the command with `docker compose --env-file .env.production exec app`.

Nobody can publish a challenge they wrote. Each challenge needs a second staff member to test-solve it, so a team needs at least two staff accounts.

## 2. Install an authenticator app

Install one free app on your phone: **Google Authenticator**, **Microsoft Authenticator**, or **2FAS**. Password managers with one-time codes, such as 1Password or Bitwarden, also work.

The app holds a secret key and turns it into a new 6-digit code every 30 seconds. dfCTF never sends you the code by email or text; you always read it from the app.

## 3. Link the app to dfCTF

1. Sign in, open your codename menu at the top right, and choose **Settings**.
2. Under **Staff verification**, enter your current password and choose **Set up authenticator**. Leave the password empty if you sign in with Google, GitHub, or Facebook.
3. **Step 01:** In the authenticator app, tap **+**, choose **Enter a setup key** (some apps call it manual entry), name it `dfCTF`, and paste the key shown. On the phone itself, you can tap **Open it in your authenticator** instead.
4. **Step 02:** Copy the backup codes into a password manager. Each one works once if you lose your phone.
5. **Step 03:** Type the 6-digit code the app now shows under dfCTF and choose **Verify code**.

Both items at the top now read `[x]`: **Authenticator app linked** and **This session verified**. Authoring and the other staff tools are unlocked.

## Every time you sign in

After your password, dfCTF shows **Verify it’s you**. Open the app and type the current code for dfCTF. That unlocks staff tools for up to 12 hours. If the time runs out while you are still signed in, Authoring shows **Go to staff verification**; enter a fresh code there.

No phone with you? Choose **Use a backup code instead** and enter one of your saved codes.

## When a code is rejected

- **Type the current code.** It changes every 30 seconds; if it is about to change, wait for the next one.
- **Check the phone's clock.** Codes depend on the time. Set the phone's date and time to automatic.
- **Pick the right entry.** Local development and the real site are separate databases, each with its own key. Name the entries clearly, for example `dfCTF local` and `dfCTF`.
- **Wait after five tries.** Five attempts in a minute trigger a short pause. Wait a minute and try again.

## Local development accounts

`npm run seed` creates `owner@dfctf.local` (administrator) and `reviewer@dfctf.local` (reviewer), with passwords in `.data/bootstrap.txt`. Each account links its own authenticator entry, and both can live in the same app. Use the owner to write a challenge and the reviewer to publish it.

## Known gap

Moving to a new phone is not in Settings yet, and there is no maintainer command to reset an authenticator. Keep your backup codes: they are currently the only way back in if you lose your phone.
