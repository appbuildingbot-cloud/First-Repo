import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export interface ConversionRecord {
  id: string;
  source_name: string;
  source_format: string;
  target_format: string;
  category: string;
  result_name: string | null;
  result_size: number | null;
  status: string;
  created_at: string;
  preview_data?: string | null;
}

export interface LogInput {
  source_name: string;
  source_format: string;
  target_format: string;
  category: string;
  result_name: string | null;
  result_size: number | null;
  status: string;
  preview_data?: string | null;
}

export async function logConversion(rec: LogInput) {
  try {
    await supabase.from('conversions').insert({
      source_name: rec.source_name,
      source_format: rec.source_format,
      target_format: rec.target_format,
      category: rec.category,
      result_name: rec.result_name,
      result_size: rec.result_size,
      status: rec.status,
      preview_data: rec.preview_data ?? null,
    });
  } catch {
    // history logging is best-effort; never block the user
  }
}

export async function fetchHistory(limit = 50): Promise<ConversionRecord[]> {
  const { data, error } = await supabase
    .from('conversions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as ConversionRecord[]) ?? [];
}

export async function clearHistory() {
  await supabase.from('conversions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
