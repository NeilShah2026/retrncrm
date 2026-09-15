/**
 * The page a magic-link tab lands on once the background worker has redeemed
 * the link (or failed to). The outcome comes in the `error` query parameter.
 */
const error = new URLSearchParams(location.search).get('error')
if (error) {
  document.getElementById('done')!.hidden = true
  document.getElementById('failed')!.hidden = false
  document.getElementById('error')!.textContent = error
  document.title = 'Couldn’t sign in · Retrn'
} else {
  document.title = 'Signed in · Retrn'
}
