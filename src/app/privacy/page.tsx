import { publicPageMetadata } from "@/lib/metadata";
import InformationPage from "@/components/information-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = publicPageMetadata("/privacy", "Privacy · dfCTF", "Learn what dfCTF stores, what other players can see, and how to request access, correction, or deletion of account information.");

export default function PrivacyPage() {
  return <InformationPage title="Privacy" introduction="How dfCTF handles account information, learning progress, and public competition activity. Updated 3 November 2026.">
    <section>
      <h2>Information we store and why</h2>
      <p>dfCTF is maintained by DFC Developers. We store your email address, verification status, public codename, account role, and account creation details to provide access and manage the platform. Email/password accounts store a password hash. If you enable two-factor authentication, we also store the information needed to verify it and manage backup codes.</p>
      <p>Signing in with Google or GitHub supplies a provider account identifier, email, and profile fields returned by that provider. The account connection can include encrypted provider tokens. The provider handles its own password; dfCTF does not receive that password.</p>
      <p>You may save an optional display name, bio, website, and GitHub profile link in your Profile dashboard. These details stay private by default. You can choose to share them with signed-in players in Socials, and turn that sharing off again in Edit profile. You also choose whether to include optional details in a downloaded player card; sharing that image makes its chosen details and practice statistics visible to its recipients.</p>
      <p>We store challenge attempts as digests and outcomes, solve times, points, competition registrations, and staff actions to operate scoring and review activity. Signed-in learning progress includes reading positions, bookmarks, and topics marked read.</p>
      <p>Reports and feedback are delivered to the private developer email inbox, including any contact email you choose to provide. The database retains a submission identifier, keyed digest, and receipt time to prevent duplicate delivery, plus a keyed address digest for rate limits. Report text and contact details are not stored in the receipt table. Developers remove private contact details before transferring reports to a public issue tracker.</p>
      <p>Sessions can record your IP address, browser information, and expiry time. Rate-limit records, request identifiers, and service logs help protect accounts and investigate errors. Do not upload personal or confidential evidence as challenge material.</p>
    </section>
    <section>
      <h2>What other players can see</h2>
      <p>Your codename, points, solve counts, solve times, first-blood recognition, and competition standings can appear publicly. Your account email and Google or GitHub profile name are not used as your public codename automatically. Account details and security records are available to authorized maintainers where needed to operate the service.</p>
      <p>Signed-in players can open player profiles from leaderboards and Socials to see codenames and practice results, plus any optional details the owner has chosen to share. Friendship does not reveal private details. We store friend requests, accepted connections, and declined-request cooldowns; each player can see only their own friends and requests. A friendship requires acceptance, either person can remove it, and the other player's friend list is not exposed.</p>
    </section>
    <section>
      <h2>Cookies and browser storage</h2>
      <p>Session cookies keep you signed in, and a theme cookie saves your appearance preference. Browser storage saves resource bookmarks, reading positions, and topics marked read. Guest progress stays in that browser. Signed-in progress also syncs with your account and can be cached locally while waiting to sync.</p>
      <p>Player-card themes, accents, and field choices are saved in this browser separately for each account. They do not sync between devices. PNG creation happens in your browser without uploading profile details to a rendering service.</p>
      <p>Clearing browser storage removes local reading data and pending changes; it does not delete your server account or previously synced progress. Shared devices should use separate browser profiles, and you should sign out when finished.</p>
    </section>
    <section>
      <h2>Service providers and external links</h2>
      <p>Our hosting, database, and email-delivery providers process the information needed to run dfCTF, store records, and deliver verification and password-reset messages. Google and GitHub process authentication when you choose those sign-in options. Their own privacy notices apply to their services.</p>
      <p>Resource links and externally hosted CTFd competitions take you to independently operated services. Check their policies before signing in, uploading files, or sharing information.</p>
    </section>
    <section>
      <h2>Retention and account requests</h2>
      <p>Account, learning, and scoring records remain stored while the service uses them; signing out does not remove them. Security records and backups may require separate handling from the active account database.</p>
      <p>To request access, correction, or deletion, email <a className="link-button" href={`mailto:${SUPPORT_EMAIL}?subject=dfCTF%20account%20data%20request`}>{SUPPORT_EMAIL}</a> from your registered email. Requests are reviewed manually after confirming account ownership. Maintainers will explain any retained security, backup, or competition records and the options for removing or anonymizing public activity. Do not send passwords, authenticator codes, or identity documents.</p>
      <p>For questions about this notice, use the same email or visit <a className="link-button" href="/support">Help / Contact</a>.</p>
    </section>
  </InformationPage>;
}
