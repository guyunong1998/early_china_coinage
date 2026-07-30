-- Adds name_zh/name_en columns to coin_type_hierarchy, each backfilled with
-- the deepest populated level for that row (level5 falling back through
-- level4, level3, level2, to level1) -- same fallback order used by
-- deriveMajorMinor() in lib/queries.ts.

ALTER TABLE coin_type_hierarchy
  ADD COLUMN name_zh text,
  ADD COLUMN name_en text;

UPDATE coin_type_hierarchy
SET
  name_zh = COALESCE(level5_zh, level4_zh, level3_zh, level2_zh, level1_zh),
  name_en = COALESCE(level5_en, level4_en, level3_en, level2_en, level1_en);
