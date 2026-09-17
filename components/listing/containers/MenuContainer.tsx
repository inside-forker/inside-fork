import { query } from "@/lib/db";
import { ListingMenu } from "@/components/listing/ListingMenu";

interface MenuContainerProps {
  listingId: number;
  menuPdfUrl?: string | null;
  restaurantName: string;
}

export async function MenuContainer({
  listingId,
  menuPdfUrl,
  restaurantName,
}: MenuContainerProps) {
  try {
    const { rows: sections } = await query(
      `SELECT * FROM menu_sections WHERE listing_id = $1 ORDER BY display_order ASC`,
      [listingId],
    );

    if (!sections || sections.length === 0) {
      return null;
    }

    const sectionIds = sections
      .map((s) => Number(s.id))
      .filter((n) => Number.isFinite(n) && n > 0);

    let items: Array<Record<string, unknown>> = [];
    if (sectionIds.length > 0) {
      const { rows } = await query(
        `SELECT * FROM menu_items WHERE section_id = ANY($1::bigint[])`,
        [sectionIds],
      );
      items = rows;
    }

    const menuSections = sections.map((section) => ({
      ...section,
      menu_items: items.filter((item) => Number(item.section_id) === Number(section.id)),
    }));

    return (
      <div id="menu-section">
        <ListingMenu
          menuSections={menuSections}
          restaurantName={restaurantName}
          menuPdfUrl={menuPdfUrl}
          listingId={listingId}
        />
      </div>
    );
  } catch (error) {
    console.error("[MenuContainer] Error:", error);
    return null;
  }
}
