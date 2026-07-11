import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleAdminSettingsGet,
  handleAdminSettingsPatch,
} from '@/lib/api/admin-settings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleAdminSettingsGet())
}

export async function PATCH(request) {
  return withCORS(await handleAdminSettingsPatch(request))
}
