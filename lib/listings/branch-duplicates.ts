/**
 * Branch duplicate detection CTE and SQL helpers.
 * Used when filtering for single-branch listings that have an accidental branch copy created
 * (e.g. "Mizaaj Restaurant" vs "Mizaaj - SMCHS").
 */

export const BRANCH_COPIES_CTE = `
  WITH branch_stems AS (
    SELECT DISTINCT LOWER(TRIM(SPLIT_PART(name, ' - ', 1))) AS stem
    FROM listings
    WHERE status = 'published'
      AND name LIKE '% - %'
      AND LENGTH(TRIM(SPLIT_PART(name, ' - ', 1))) >= 3
  ),
  parent_candidates AS (
    SELECT l.id, bs.stem
    FROM listings l
    JOIN branch_stems bs ON (
      LOWER(l.name) = bs.stem
      OR LOWER(l.name) LIKE bs.stem || ' %'
    )
    WHERE l.status = 'published'
      AND l.name NOT LIKE '% - %'
  ),
  matched_stems AS (
    SELECT DISTINCT stem FROM parent_candidates
  ),
  duplicate_pairs AS (
    SELECT l.id,
           CASE
             WHEN l.name LIKE '% - %' THEN LOWER(TRIM(SPLIT_PART(l.name, ' - ', 1)))
             ELSE ms.stem
           END AS match_stem
    FROM matched_stems ms
    JOIN listings l ON (
      (l.name LIKE '% - %' AND LOWER(TRIM(SPLIT_PART(l.name, ' - ', 1))) = ms.stem)
      OR
      (l.name NOT LIKE '% - %' AND (LOWER(l.name) = ms.stem OR LOWER(l.name) LIKE ms.stem || ' %'))
    )
    WHERE l.status = 'published'
  )
`;
