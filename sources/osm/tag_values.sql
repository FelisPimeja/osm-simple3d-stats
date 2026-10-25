select
  t.k as key,
  v as value,
  count(*) as changesets
from read_json('data/changesets/*.jsonl', format = 'newline_delimited', union_by_name = true),
  unnest(tags) as u(t),
  unnest(t.v) as w(v)
where cast(cast(date as timestamp) as date) < current_date
group by all
