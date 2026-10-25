-- OpenHistoricalMap and OpenGeofiction: changeset metadata only (no OSMCha, so no tag changes)
select
  project,
  id,
  cast(date as timestamp) as created_at,
  cast(cast(date as timestamp) as date) as day,
  "user",
  uid,
  via,
  comment,
  source,
  imagery_used,
  changes,
  (bbox[1] + bbox[3]) / 2 as lon,
  (bbox[2] + bbox[4]) / 2 as lat
from (
  select 'OpenHistoricalMap' as project, * from read_json('data/ohm.jsonl', format = 'newline_delimited', union_by_name = true)
  union all by name
  select 'OpenGeofiction' as project, * from read_json('data/ogf.jsonl', format = 'newline_delimited', union_by_name = true)
)
where cast(cast(date as timestamp) as date) < current_date
