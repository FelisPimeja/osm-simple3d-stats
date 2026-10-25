-- one row per (changeset, source type) and per (changeset, imagery name); empty source → 'не указан'
with cs as (
  select id, uid, coalesce(via, 'editor') as via, cast(cast(date as timestamp) as date) as day, source, imagery_used
  from read_json('data/changesets/*.jsonl', format = 'newline_delimited', union_by_name = true)
  where cast(cast(date as timestamp) as date) < current_date
)
select id, uid, via, day, 'type' as kind, trim(s) as name
from cs, unnest(string_split(coalesce(nullif(source, ''), 'не указан'), ';')) as u(s)
union all
select id, uid, via, day, 'imagery' as kind, trim(s) as name
from cs, unnest(string_split(imagery_used, ';')) as u(s)
where coalesce(imagery_used, '') <> ''
