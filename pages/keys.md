---
title: Ключи
---

```sql keys
select key, count(*) as changesets, count(distinct uid) as users, max(day) as last_used
from osm.tag_changes
group by key
order by changesets desc
```

<DataTable data={keys} search=true rows=30/>

```sql weekly_keys
with top as (
  select key from osm.tag_changes group by key order by count(*) desc limit 8
)
select date_trunc('week', day) as week, key, count(*) as changesets
from osm.tag_changes where key in (select key from top)
group by all order by week
```

<BarChart data={weekly_keys} x=week y=changesets series=key title="Топ-8 ключей по неделям"/>

## Значения

```sql key_list
select key from osm.tag_changes group by key order by count(*) desc
```

<Dropdown data={key_list} name=key value=key defaultValue="building"/>

```sql values
select value, changesets
from osm.tag_values
where key = '${inputs.key.value}'
order by changesets desc
limit 30
```

<BarChart data={values} x=value y=changesets swapXY=true sort=false title="Значения выбранного ключа"/>
