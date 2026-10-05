import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RoutingResult = {
  connected?: boolean;
  ready?: boolean;
  can_create?: boolean;
  synced?: number;
  errors?: string[];
  next_offset?: number | null;
  error?: string;
};

export async function invokeRouting(supabase: SupabaseClient, body: Record<string, unknown>): Promise<RoutingResult> {
  const { data, error } = await supabase.functions.invoke("cloudflare-routing", { body });
  if (!error) return data as RoutingResult;
  if (error.context instanceof Response) {
    const result = await error.context.json().catch(() => null);
    if (typeof result?.error === "string") return { error: result.error };
  }
  return { error: "Could not connect to email routing. Please try again." };
}
