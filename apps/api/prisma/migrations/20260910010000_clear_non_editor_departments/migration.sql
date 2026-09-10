UPDATE "users"
SET "department_id" = NULL
WHERE "role_id" IN (
    SELECT "id" FROM "roles" WHERE "name" <> 'DEPARTMENT_EDITOR'
);
