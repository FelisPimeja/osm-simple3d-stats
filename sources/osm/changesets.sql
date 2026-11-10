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
  coalesce(n.country, 'Не определена') as country,
  n.iso,
  -- Simple Indoor: the editor's "Indoor plans:" comment section or indoor keys; Simple 3D: building/roof shape keys.
  -- A changeset without either (tags not yet processed by OSMCha, geometry only) counts as 3D.
  (starts_with(comment, 'Indoor plans:') or starts_with(comment, 'Поэтажные планы:')
    or list_has_any(list_transform(tags, t -> t.k), ['indoor', 'level', 'repeat_on', 'door', 'room'])) as has_indoor,
  (list_has_any(list_transform(tags, t -> t.k), ['height', 'min_height', 'building:levels', 'building:min_level',
      'roof:levels', 'building:part', 'building:colour', 'building:material', 'roof:colour', 'roof:material'])
    or len(list_filter(tags, t -> starts_with(t.k, 'roof:'))) > 0) as has_3d,
  case
    when not has_indoor then 'Simple 3D'
    when has_3d then 'Simple 3D + Indoor'
    else 'Simple Indoor'
  end as kind,
  is_suspect,
  checked,
  harmful
from read_json('data/changesets/*.jsonl', format = 'newline_delimited', union_by_name = true) c
  left join read_json('data/countries.jsonl', format = 'newline_delimited') n using (id)
-- the current UTC day is incomplete
where cast(cast(date as timestamp) as date) < current_date
