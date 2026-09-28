// Only explicit authentication creates an invitation. Restoring Firebase state,
// refreshing a token, opening a tab, or reloading never creates one.
const pending = new Set();
export function inviteReminderSetup(uid) {
  pending.add(uid);
  window.dispatchEvent(new CustomEvent('lifeos-login-complete', {detail:{uid}}));
}
export function consumeReminderInvitation(uid) {
  const invited = pending.has(uid);
  pending.delete(uid);
  return invited;
}
