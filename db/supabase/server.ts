import { cookies } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

export const createClient = () => {
  const cookieStorePromise = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookieStorePromise
          return cookieStore.get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            const cookieStore = await cookieStorePromise
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Called from a Server Component — safe to ignore when middleware refreshes sessions.
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            const cookieStore = await cookieStorePromise
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            // Called from a Server Component — safe to ignore when middleware refreshes sessions.
          }
        },
      },
    }
  )
}
