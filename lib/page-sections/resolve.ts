import { query } from "@/lib/db";
import {
  PAGE_SECTIONS_CONFIG_KEY,
  DEFAULT_PAGE_SECTIONS_CONFIG,
  parsePageSectionsConfig,
  type PageSectionsConfig,
} from "./types";

export async function getPageSectionsConfig(): Promise<PageSectionsConfig> {
  try {
    const { rows } = await query(
      `SELECT config_value FROM system_config WHERE config_key = $1 LIMIT 1`,
      [PAGE_SECTIONS_CONFIG_KEY],
    );
    if (rows.length === 0) {
      return JSON.parse(JSON.stringify(DEFAULT_PAGE_SECTIONS_CONFIG));
    }
    return parsePageSectionsConfig(rows[0].config_value);
  } catch (error) {
    console.error("[page-sections] failed to load config:", error);
    return JSON.parse(JSON.stringify(DEFAULT_PAGE_SECTIONS_CONFIG));
  }
}

export async function savePageSectionsConfig(
  config: PageSectionsConfig,
  updatedBy: string,
): Promise<PageSectionsConfig> {
  const cleaned = parsePageSectionsConfig(config);
  const serialized = JSON.stringify(cleaned);

  await query(
    `INSERT INTO public.system_config (config_key, config_value, config_type, description, is_public, updated_by)
     VALUES ($1, $2::jsonb, 'setting', $3, false, $4)
     ON CONFLICT (config_key)
     DO UPDATE SET
       config_value = EXCLUDED.config_value,
       config_type = EXCLUDED.config_type,
       description = EXCLUDED.description,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [
      PAGE_SECTIONS_CONFIG_KEY,
      serialized,
      "Mobile feed section on/off toggles for Home, Explore, Events, and Deals.",
      updatedBy,
    ],
  );

  return cleaned;
}
