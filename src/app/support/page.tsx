import type { Metadata } from "next";
import InformationPage from "@/components/information-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Help / Contact · dfCTF", description: "Get help with a dfCTF account, report a broken challenge, or contact the maintainers privately." };

export default function SupportPage() {
  return <InformationPage title="Help / Contact" introduction="Contact the dfCTF maintainers about account access, challenge problems, or private reports.">
    <section>
      <h2>Account and challenge help</h2>
      <p>Email <a className="link-button" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. For account problems, use your registered email when possible. Include the page address, what you expected, what happened, and the approximate time in Philippine time (UTC+8). Include a request ID if an error shows one.</p>
      <p>Keep passwords, authenticator codes, backup codes, session cookies, and provider secrets out of your message. For challenge problems, describe the issue without sending flags or private challenge files unless a maintainer asks for them.</p>
    </section>
    <section>
      <h2>Report a vulnerability privately</h2>
      <p>Send a private report to <a className="link-button" href={`mailto:${SUPPORT_EMAIL}?subject=dfCTF%20private%20security%20report`}>{SUPPORT_EMAIL}</a> with the affected page and the minimum evidence needed to explain the problem. Stop investigating when you identify a possible issue; do not access other accounts, change scores, or publish sensitive details.</p>
      <p>Use this private channel for suspected cheating or exposed challenge answers too. Avoid putting those details in public GitHub issues.</p>
    </section>
    <section>
      <h2>Account and data requests</h2>
      <p>For a request to access, correct, or delete account information, email <a className="link-button" href={`mailto:${SUPPORT_EMAIL}?subject=dfCTF%20account%20data%20request`}>{SUPPORT_EMAIL}</a> from your registered address. Requests are handled manually and require confirmation of account ownership. Do not send a password or identity document.</p>
    </section>
    <section>
      <h2>Public bug reports and suggestions</h2>
      <p>For a reproducible, non-sensitive issue or feature suggestion, use the <a className="link-button" href="https://github.com/Llenoxinn/dfCTF/issues">dfCTF issue tracker</a>. Use fictional examples and remove personal information from screenshots.</p>
    </section>
  </InformationPage>;
}
