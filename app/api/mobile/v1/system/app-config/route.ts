import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  PAGE_SECTIONS_CONFIG_KEY,
  parsePageSectionsConfig,
} from "@/lib/page-sections/types";

export const dynamic = "force-dynamic";

/** `config_value` is jsonb but some rows store a JSON-encoded string (double-encoded) — unwrap once more if so. */
function unwrapConfigValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "true";
}

const CONFIG_KEYS = [
  // Maintenance keys (mobile-specific or fallback to global)
  "mobile.maintenance.enabled",
  "mobile.maintenance.title",
  "mobile.maintenance.message",
  "mobile.maintenance.estimated_end",
  "maintenance.enabled",
  "maintenance.message",
  "maintenance.estimated_end",
  // Version & Force Update keys
  "mobile.min_version",
  "mobile.latest_version",
  "mobile.force_update_enabled",
  "mobile.update_title",
  "mobile.update_message",
  "mobile.android_store_url",
  "mobile.ios_store_url",
  // Feed sections toggle key
  PAGE_SECTIONS_CONFIG_KEY,
];

/**
 * GET /api/mobile/v1/system/app-config  (public, unauthenticated)
 *
 * Provides startup configuration for mobile clients including:
 * - Maintenance mode status and details
 * - Version requirements & force update parameters
 * - Store URLs for updates
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  let rows;
  try {
    const placeholders = CONFIG_KEYS.map((_, i) => `$${i + 1}`).join(", ");
    const result = await query(
      `SELECT config_key, config_value FROM system_config
       WHERE config_key IN (${placeholders})`,
      CONFIG_KEYS,
    );
    rows = result.rows;
  } catch (error) {
    console.error(
      "[mobile-api] app-config query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load app configuration.",
      500,
    );
  }

  const byKey = new Map(rows.map((r) => [r.config_key, unwrapConfigValue(r.config_value)]));

  // Maintenance: Prefer mobile-specific key if defined, else fallback to global maintenance
  const mobileMaintenanceRaw = byKey.get("mobile.maintenance.enabled");
  const globalMaintenanceRaw = byKey.get("maintenance.enabled");
  const maintenanceEnabled =
    mobileMaintenanceRaw !== undefined
      ? isTruthy(mobileMaintenanceRaw)
      : isTruthy(globalMaintenanceRaw);

  const maintenanceTitle =
    typeof byKey.get("mobile.maintenance.title") === "string"
      ? (byKey.get("mobile.maintenance.title") as string)
      : "System Under Maintenance";

  const maintenanceMessage =
    typeof byKey.get("mobile.maintenance.message") === "string"
      ? (byKey.get("mobile.maintenance.message") as string)
      : typeof byKey.get("maintenance.message") === "string"
      ? (byKey.get("maintenance.message") as string)
      : "We are performing scheduled maintenance to improve your experience. We'll be back shortly!";

  const maintenanceEstimatedEnd =
    typeof byKey.get("mobile.maintenance.estimated_end") === "string"
      ? (byKey.get("mobile.maintenance.estimated_end") as string)
      : typeof byKey.get("maintenance.estimated_end") === "string"
      ? (byKey.get("maintenance.estimated_end") as string)
      : null;

  // Force Update & Versioning
  const minVersion =
    typeof byKey.get("mobile.min_version") === "string"
      ? (byKey.get("mobile.min_version") as string)
      : "1.0.0";

  const latestVersion =
    typeof byKey.get("mobile.latest_version") === "string"
      ? (byKey.get("mobile.latest_version") as string)
      : "1.0.0";

  const forceUpdateEnabled =
    byKey.get("mobile.force_update_enabled") !== undefined
      ? isTruthy(byKey.get("mobile.force_update_enabled"))
      : true;

  const updateTitle =
    typeof byKey.get("mobile.update_title") === "string"
      ? (byKey.get("mobile.update_title") as string)
      : "Update Required";

  const updateMessage =
    typeof byKey.get("mobile.update_message") === "string"
      ? (byKey.get("mobile.update_message") as string)
      : "A new version of Inside Karachi is available with improvements and fixes. Please update to continue.";

  const androidStoreUrl =
    typeof byKey.get("mobile.android_store_url") === "string"
      ? (byKey.get("mobile.android_store_url") as string)
      : "https://play.google.com/store/apps/details?id=com.inside.cityguide";

  const iosStoreUrl =
    typeof byKey.get("mobile.ios_store_url") === "string"
      ? (byKey.get("mobile.ios_store_url") as string)
      : "https://apps.apple.com/app/inside-karachi/id6470000000";

  const sections = parsePageSectionsConfig(byKey.get(PAGE_SECTIONS_CONFIG_KEY));

  return ok(
    {
      maintenance: {
        enabled: maintenanceEnabled,
        title: maintenanceTitle,
        message: maintenanceMessage,
        estimated_end: maintenanceEstimatedEnd,
      },
      update: {
        min_version: minVersion,
        latest_version: latestVersion,
        force_update_enabled: forceUpdateEnabled,
        title: updateTitle,
        message: updateMessage,
        android_store_url: androidStoreUrl,
        ios_store_url: iosStoreUrl,
      },
      sections,
    },
    undefined,
    {
      headers: {
        "Cache-Control": "private, max-age=0, s-maxage=60",
      },
    },
  );
});