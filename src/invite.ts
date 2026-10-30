// Carries an invite code to the signup hook. A cookie rather than a form field
// because Google signup leaves for a redirect and only a cookie survives the
// trip; password signup uses it too, so both paths share one check.
export const INVITE_COOKIE = "stash_invite";
