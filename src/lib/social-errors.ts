/** Provider descriptions may contain private details; show only messages we control. */
export function socialSignInError(code: string | null): string {
  if (code === "access_denied") return "Social sign-in was cancelled or declined. Try again, choose another provider, or use email and password.";
  if (code === "account_not_linked") return "An account already uses this email. Sign in with its existing method, then connect this provider in Settings.";
  if (code === "email_not_verified") return "Your email must be verified before you can sign in. Check your inbox or verify the email with your provider, then try again.";
  return "Social sign-in could not be completed. Try again or use email and password. If it keeps failing, contact support.";
}
