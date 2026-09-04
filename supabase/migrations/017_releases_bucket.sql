-- 017: public "releases" bucket for APK downloads + latest.json (the in-app "Update available" check and the
-- invite link). Read is public by design (a download page). Nothing can write except the service role
-- (scripts/publish-release.js). Safe to re-run.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('releases', 'releases', true, 209715200, array['application/vnd.android.package-archive', 'application/octet-stream', 'application/json', 'text/plain'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- no client policies on purpose: public buckets serve GET without RLS; INSERT/UPDATE/DELETE stay refused for anon/authenticated
