
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM shell_listing_version WHERE app_id = 'cn.kaypal.original.optical';
DELETE FROM shell_listing_app WHERE app_id = 'cn.kaypal.original.optical';
COMMIT;
