import { Browser } from '@capacitor/browser'
import { PRODUCTION_ORIGIN } from '@/lib/apiBase'
import { isNative } from '@/lib/platform'
import { track } from '@/lib/analytics'

/** Built by `npm run template` into public/, so it's a plain static file. */
export const TEMPLATE_PATH = '/templates/Retrn-Contacts-Template.xlsx'
export const TEMPLATE_FILENAME = 'Retrn-Contacts-Template.xlsx'

/**
 * Hand the person the template.
 *
 * In a browser it's an ordinary download. The iOS app's WebView can't save
 * files, so there it opens the hosted copy in Safari's in-app sheet, whose
 * share button saves it to Files or opens it in Excel or Numbers.
 */
export async function downloadTemplate(from: string): Promise<void> {
  track('import_template_downloaded', { from })
  if (isNative) {
    await Browser.open({ url: `${PRODUCTION_ORIGIN}${TEMPLATE_PATH}` })
    return
  }
  const a = document.createElement('a')
  a.href = TEMPLATE_PATH
  a.download = TEMPLATE_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
}
