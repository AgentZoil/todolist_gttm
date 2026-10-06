UPDATE "tasks" AS task
SET "coordinating_units" = concat_ws(
  ', ',
  NULLIF(btrim(task."coordinating_units"), ''),
  coordination.department_names
)
FROM (
  SELECT
    link."task_id",
    string_agg(department."name", ', ' ORDER BY department."name") AS department_names
  FROM "task_coordinating_departments" AS link
  JOIN "departments" AS department
    ON department."id" = link."department_id"
  GROUP BY link."task_id"
) AS coordination
WHERE task."id" = coordination."task_id";

DROP TABLE IF EXISTS "task_coordinating_departments";
