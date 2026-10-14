-- Brand groups link separate location listings (e.g. "KFC - Boat Basin" +
-- "KFC - Dolmen") so detail pages can show Other locations. One listing
-- belongs to at most one group.

CREATE TABLE IF NOT EXISTS public.brand_groups (
  id         bigserial PRIMARY KEY,
  name       text        NOT NULL,
  slug       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_groups_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.brand_group_members (
  group_id    bigint      NOT NULL REFERENCES public.brand_groups(id) ON DELETE CASCADE,
  listing_id  bigint      NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sort_order  integer     NOT NULL DEFAULT 0,
  source      text        NOT NULL DEFAULT 'manual',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, listing_id),
  CONSTRAINT brand_group_members_listing_unique UNIQUE (listing_id),
  CONSTRAINT brand_group_members_source_check
    CHECK (source IN ('manual', 'stem_import', 'split_from_branch'))
);

CREATE INDEX IF NOT EXISTS brand_group_members_listing_idx
  ON public.brand_group_members (listing_id);

CREATE INDEX IF NOT EXISTS brand_group_members_group_sort_idx
  ON public.brand_group_members (group_id, sort_order);

COMMENT ON TABLE public.brand_groups IS
  'Multi-location brand container. Members are separate listings (one per outlet).';

COMMENT ON TABLE public.brand_group_members IS
  'Membership of a listing in a brand group. listing_id is unique so a listing cannot belong to two brands.';
