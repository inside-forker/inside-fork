/**
 * Exclude non-discovery / non-leisure categories (Education, Schools, Universities,
 * Hospitals, Clinics, Medical facilities) from Worth the Detour / Hidden Gems.
 */
export const DETOUR_CATEGORY_EXCLUSION_SQL = `
  NOT (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = ld.category_id
        AND (
          c.slug IN (
            'education-learning', 'education',
            'schools-pre-schools', 'colleges-universities-institutes',
            'tutoring-coaching-centers', 'skill-vocational-training',
            'language-learning-centers', 'test-prep',
            'clinics-hospitals', 'hospitals', 'clinics',
            'diagnostic-labs-imaging', 'pharmacies-medical-stores',
            'dental-eye-care'
          )
          OR c.parent_id IN (
            SELECT p.id FROM categories p WHERE p.slug IN ('education-learning', 'education')
          )
          OR LOWER(c.name) LIKE '%school%'
          OR LOWER(c.name) LIKE '%college%'
          OR LOWER(c.name) LIKE '%university%'
          OR LOWER(c.name) LIKE '%institute%'
          OR LOWER(c.name) LIKE '%coaching%'
          OR LOWER(c.name) LIKE '%hospital%'
          OR LOWER(c.name) LIKE '%clinic%'
          OR LOWER(c.name) LIKE '%diagnostic%'
          OR LOWER(c.name) LIKE '%medical store%'
          OR LOWER(c.name) LIKE '%pharmacy%'
        )
    )
    OR EXISTS (
      SELECT 1 FROM listing_categories lc
      JOIN categories c ON c.id = lc.category_id
      WHERE lc.listing_id = ld.id
        AND (
          c.slug IN (
            'education-learning', 'education',
            'schools-pre-schools', 'colleges-universities-institutes',
            'tutoring-coaching-centers', 'skill-vocational-training',
            'language-learning-centers', 'test-prep',
            'clinics-hospitals', 'hospitals', 'clinics',
            'diagnostic-labs-imaging', 'pharmacies-medical-stores',
            'dental-eye-care'
          )
          OR c.parent_id IN (
            SELECT p.id FROM categories p WHERE p.slug IN ('education-learning', 'education')
          )
          OR LOWER(c.name) LIKE '%school%'
          OR LOWER(c.name) LIKE '%college%'
          OR LOWER(c.name) LIKE '%university%'
          OR LOWER(c.name) LIKE '%institute%'
          OR LOWER(c.name) LIKE '%coaching%'
          OR LOWER(c.name) LIKE '%hospital%'
          OR LOWER(c.name) LIKE '%clinic%'
          OR LOWER(c.name) LIKE '%diagnostic%'
          OR LOWER(c.name) LIKE '%medical store%'
          OR LOWER(c.name) LIKE '%pharmacy%'
        )
    )
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%school%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%college%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%university%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%institute%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%education%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%tutoring%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%coaching%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%hospital%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%clinic%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%diagnostic%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%pharmacy%'
    OR LOWER(COALESCE(ld.category_name, '')) LIKE '%medical store%'
  )
`;
