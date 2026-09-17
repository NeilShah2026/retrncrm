import { handleDeleteAccountRequest } from './_lib/deleteAccount'

/**
 * POST /api/delete-account — permanently deletes the caller's own account and
 * everything that cascades from it. Runs on the edge with the service role
 * key, which is why the implementation lives in `_lib` rather than the
 * client bundle. See `_lib/deleteAccount.ts`.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleDeleteAccountRequest(req)
}
