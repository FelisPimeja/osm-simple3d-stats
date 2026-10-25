select
  id,
  cast(date as timestamp) as created_at,
  cast(cast(date as timestamp) as date) as day,
  "user",
  uid,
  comment,
  coalesce(via, 'editor') as via,
  editor,
  source,
  imagery_used,
  "create" as created,
  "modify" as modified,
  "delete" as deleted,
  "create" + "modify" + "delete" as edits,
  len(tags) as keys_touched,
  (bbox[1] + bbox[3]) / 2 as lon,
  (bbox[2] + bbox[4]) / 2 as lat,
  hashtags,
  is_suspect,
  checked,
  harmful
from read_json('data/changesets/*.jsonl', format = 'newline_delimited', union_by_name = true)
-- the current UTC day is incomplete
where cast(cast(date as timestamp) as date) < current_date
