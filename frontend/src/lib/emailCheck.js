// Email normalization + disposable-address check.
// Runs client-side on the Login form *and* again server-side in api/rf.mjs
// to block bots that skip the UI.

import disposableList from 'disposable-email-domains'

const disposableSet = new Set(disposableList.map(d => d.toLowerCase()))

/**
 * Normalize an email to catch the common "one person, many accounts" tricks.
 * - lowercases
 * - strips whitespace
 * - removes "+suffix" on the local part (foo+spam@a.com -> foo@a.com)
 * - removes dots from the local part on gmail/googlemail (they're ignored by Google)
 */
export function normalizeEmail(raw) {
  if (!raw) return ''
  const email = raw.trim().toLowerCase()
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  let normalizedLocal = local.split('+')[0]
  const isGmail = domain === 'gmail.com' || domain === 'googlemail.com'
  if (isGmail) normalizedLocal = normalizedLocal.replace(/\./g, '')
  return `${normalizedLocal}@${domain}`
}

/** True if the email's domain is in the disposable-email-domains list. */
export function isDisposable(email) {
  if (!email) return false
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain) return false
  return disposableSet.has(domain)
}

/** Basic shape check before we bother hitting Supabase. */
export function looksLikeEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')
}
