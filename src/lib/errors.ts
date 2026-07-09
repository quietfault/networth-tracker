// Supabase throws plain PostgrestError objects, not Error instances, so
// `e instanceof Error` misses them and String(e) prints "[object Object]".
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message
  }
  return String(e)
}
