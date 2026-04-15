export function describeAuthCallbackError(
  error: string | undefined,
  message: string | undefined
): string | null {
  if (!error) return null;
  if (error === "session") {
    if (message) {
      try {
        return decodeURIComponent(message);
      } catch {
        return null;
      }
    }
    return (
      "That sign-in link did not finish in the browser. Open the invite link again, " +
      "or use the same browser you normally use for this site. You can also sign in below if you already set a password."
    );
  }
  if (error === "profile") {
    return (
      "You are signed in, but this account is not linked to a salon yet. " +
      "Finish the invite link from your email, or ask your administrator to add you to the organization."
    );
  }
  if (error === "admin" || error === "forbidden") {
    if (message) {
      try {
        return decodeURIComponent(message);
      } catch {
        // continue to generic fallback below
      }
    }
    return (
      "This account cannot access Admin. " +
      "Sign in with an authorized admin email or ask the owner to grant access."
    );
  }
  try {
    return decodeURIComponent(error);
  } catch {
    return error;
  }
}
