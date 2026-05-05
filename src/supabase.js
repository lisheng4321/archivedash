import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

// ─── Data layer (mirrors window.storage API) ───

export async function load(key, fallback) {
  try {
    if (!supabase) return fallback
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fallback

    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', key)
      .single()

    if (error || !data) return fallback
    return data.value
  } catch {
    return fallback
  }
}

export async function save(key, value) {
  try {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('app_data')
      .upsert({ user_id: user.id, key, value, updated_at: new Date().toISOString() }, 
        { onConflict: 'user_id,key' })
  } catch (e) {
    console.error('Save failed:', e)
  }
}
