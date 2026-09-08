import { handleVerifyEduRequest } from './_lib/eduVerify'

/**
 * POST /api/verify-edu — grants (or clears) free access for a verified school
 * email. Runs on the edge with the service role key, which is why it lives
 * here rather than in the bundle. See `_lib/eduVerify.ts` for the whole flow.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleVerifyEduRequest(req)
}
