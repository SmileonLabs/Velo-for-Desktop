import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VIDEO_DAILY_FREE_LIMIT = 3;
const IMAGE_DAILY_FREE_LIMIT = 20;
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, serviceRoleKey);

const toIsoTomorrowUtc = () => {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return tomorrow.toISOString();
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const deviceId = String(body?.deviceId ?? "").trim();
    const commit = Boolean(body?.commit);
    const requestedFilesRaw = Number(body?.requestedFiles ?? 1);
    const requestedFiles = Number.isFinite(requestedFilesRaw) ? Math.max(1, Math.floor(requestedFilesRaw)) : 1;
    const mediaType = body?.mediaType === "image" ? "image" : "video";
    const dailyLimit = mediaType === "image" ? IMAGE_DAILY_FREE_LIMIT : VIDEO_DAILY_FREE_LIMIT;
    const usageKey = `${deviceId}:${mediaType}`;

    if (!deviceId) {
      return new Response(JSON.stringify({ allowed: false, reason: "INVALID_REQUEST" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Paid users (active license bound to this device) are unlimited.
    const { data: paidRows, error: paidError } = await supabase
      .from("devices")
      .select("id,license_activations!inner(deactivated_at,licenses!inner(status,expires_at))")
      .eq("device_fingerprint", deviceId)
      .limit(1);
    if (paidError) throw paidError;

    const paidDevice = paidRows?.[0] as any;
    const activations = Array.isArray(paidDevice?.license_activations) ? paidDevice.license_activations : [];
    const hasPaidActive = activations.some((a: any) => {
      if (a?.deactivated_at) return false;
      const license = Array.isArray(a?.licenses) ? a.licenses[0] : a?.licenses;
      if (!license || license.status !== "active") return false;
      if (!license.expires_at) return true;
      return new Date(license.expires_at).getTime() > Date.now();
    });

    if (hasPaidActive) {
      return new Response(
        JSON.stringify({
          allowed: true,
          isPaid: true,
          remaining: null,
          resetAt: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: existingRows, error: existingError } = await supabase
      .from("free_daily_usage")
      .select("files_used")
      .eq("device_fingerprint", usageKey)
      .eq("usage_date", today)
      .limit(1);
    if (existingError) throw existingError;

    const used = Number(existingRows?.[0]?.files_used ?? 0);
    const remaining = Math.max(0, dailyLimit - used);
    if (requestedFiles > remaining) {
      return new Response(
        JSON.stringify({
          allowed: false,
          isPaid: false,
          remaining,
          resetAt: toIsoTomorrowUtc(),
          reason: "FREE_LIMIT_REACHED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Preview only: do not consume quota.
    if (!commit) {
      return new Response(
        JSON.stringify({
          allowed: true,
          isPaid: false,
          remaining,
          resetAt: toIsoTomorrowUtc(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nextUsed = used + requestedFiles;
    const { error: upsertError } = await supabase
      .from("free_daily_usage")
      .upsert(
        {
          device_fingerprint: usageKey,
          usage_date: today,
          files_used: nextUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_fingerprint,usage_date" },
      );
    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        allowed: true,
        isPaid: false,
        remaining: Math.max(0, dailyLimit - nextUsed),
        resetAt: toIsoTomorrowUtc(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("check-free-quota error:", message);
    return new Response(JSON.stringify({ allowed: false, reason: "SERVER_ERROR", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
