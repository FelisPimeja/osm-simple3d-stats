-- one row per (changeset, key); values are the new values seen in the changeset
select
  id,
  cast(cast(date as timestamp) as date) as day,
  uid,
  t.k as key,
  array_to_string(t.v, ' | ') as "values"
from read_json('data/changesets/*.jsonl', format = 'newline_delimited', union_by_name = true),
  unnest(tags) as u(t)
