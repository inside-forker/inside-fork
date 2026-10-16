/**
 * Branch duplicate detection CTE and SQL helpers.
 * Used when filtering for single-branch listings that have an accidental branch copy created
 * (e.g. "Mizaaj Restaurant" vs "Mizaaj - SMCHS").
 */

export const BRANCH_COPIES_CTE = `
  WITH branch_listings AS (
    SELECT l.id, l.name, l.status, l.created_at, l.category_id,
           COALESCE(c.parent_id, c.id) AS top_category_id,
           LOWER(TRIM(SPLIT_PART(l.name, ' - ', 1))) AS full_stem,
           LOWER(TRIM(SPLIT_PART(SPLIT_PART(l.name, ' - ', 1), ' ', 1))) AS first_word
    FROM listings l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.status = 'published'
      AND l.name LIKE '% - %'
      AND LENGTH(TRIM(SPLIT_PART(l.name, ' - ', 1))) >= 3
  ),
  single_branches AS (
    SELECT bl.*
    FROM branch_listings bl
    WHERE bl.first_word NOT IN ('dr.', 'dr', 'the', 'institute', 'sindh', 'al', 'new', 'shree', 'karachi', 'pakistan')
      AND LENGTH(bl.first_word) >= 3
      AND bl.first_word IN (
        SELECT first_word
        FROM branch_listings
        GROUP BY first_word
        HAVING COUNT(*) = 1
      )
  ),
  parent_listings AS (
    SELECT l.id, l.name, l.status, l.created_at, l.category_id,
           COALESCE(c.parent_id, c.id) AS top_category_id,
           LOWER(TRIM(SPLIT_PART(l.name, ' ', 1))) AS first_word
    FROM listings l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.status = 'published'
      AND l.name NOT LIKE '% - %'
  ),
  candidate_pairs AS (
    SELECT 
      sb.id AS branch_id, sb.name AS branch_name, sb.created_at AS branch_created,
      p.id AS parent_id, p.name AS parent_name, p.created_at AS parent_created,
      sb.first_word AS stem
    FROM single_branches sb
    JOIN parent_listings p ON p.first_word = sb.first_word
    WHERE 
      (sb.top_category_id IS NULL OR p.top_category_id IS NULL OR sb.top_category_id = p.top_category_id)
      AND (
        LOWER(p.name) = sb.full_stem
        OR LOWER(p.name) LIKE sb.full_stem || ' %'
        OR LOWER(sb.full_stem) = LOWER(p.name)
        OR LOWER(sb.full_stem) LIKE LOWER(p.name) || ' %'
        OR LOWER(p.name) LIKE sb.first_word || ' %'
      )
  ),
  clean_stems AS (
    SELECT stem
    FROM candidate_pairs
    GROUP BY stem
    HAVING COUNT(*) = 1
  ),
  duplicate_pairs AS (
    SELECT cp.branch_id AS id, cp.stem AS match_stem, 'branch_copy' AS duplicate_role
    FROM candidate_pairs cp
    JOIN clean_stems cs ON cs.stem = cp.stem
    UNION ALL
    SELECT cp.parent_id AS id, cp.stem AS match_stem, 'original_parent' AS duplicate_role
    FROM candidate_pairs cp
    JOIN clean_stems cs ON cs.stem = cp.stem
  )
`;
