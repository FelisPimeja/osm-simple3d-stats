---
title: osm-simple3d-editor — статистика
---

Чейнджсеты с `created_by=osm-simple3d-editor` по данным [OSMCha](https://osmcha.org). Обновляется раз в сутки.

```sql totals
select
  count(*) as changesets,
  count(distinct uid) as users,
  sum(edits) as edits,
  sum(created) as created,
  sum(modified) as modified,
  median(edits) as median_edits,
  max(created_at) as last_changeset
from osm.changesets
```

<BigValue data={totals} value=users title="Пользователей"/>
<BigValue data={totals} value=changesets title="Чейнджсетов"/>
<BigValue data={totals} value=edits title="Правок объектов"/>
<BigValue data={totals} value=median_edits title="Медиана объектов на чейнджсет"/>
<BigValue data={totals} value=last_changeset title="Последний чейнджсет" fmt="yyyy-mm-dd H:MM"/>

## По дням

```sql daily
with first_seen as (
  select uid, min(day) as first_day from osm.changesets group by uid
)
select
  c.day,
  count(*) as changesets,
  count(distinct c.uid) as users,
  count(distinct case when f.first_day = c.day then c.uid end) as new_users,
  sum(c.created) as created,
  sum(c.modified) as modified,
  sum(c.deleted) as deleted
from osm.changesets c join first_seen f using (uid)
group by c.day
order by c.day
```

```sql cumulative
select day, sum(new_users) over (order by day) as users_total from ${daily}
```

<LineChart data={daily} x=day y={["changesets", "users"]} title="Чейнджсеты и активные пользователи в сутки" markers=true/>

<BarChart data={daily} x=day y=new_users title="Новые пользователи в сутки"/>

<AreaChart data={cumulative} x=day y=users_total title="Пользователей всего"/>

<BarChart data={daily} x=day y={["created", "modified", "deleted"]} title="Объекты в сутки: создано / изменено / удалено"/>

## Размер чейнджсета

```sql sizes
select
  case
    when edits = 1 then '1'
    when edits <= 5 then '2–5'
    when edits <= 20 then '6–20'
    when edits <= 100 then '21–100'
    else '100+'
  end as size,
  min(edits) as ord,
  count(*) as changesets
from osm.changesets
group by size
order by ord
```

```sql per_changeset
select
  round(avg(created), 1) as avg_created,
  round(avg(modified), 1) as avg_modified,
  round(avg(deleted), 2) as avg_deleted,
  round(avg(keys_touched), 1) as avg_keys
from osm.changesets
```

<BarChart data={sizes} x=size y=changesets title="Распределение чейнджсетов по числу объектов" sort=false/>

<BigValue data={per_changeset} value=avg_created title="Создано, в среднем"/>
<BigValue data={per_changeset} value=avg_modified title="Изменено, в среднем"/>
<BigValue data={per_changeset} value=avg_deleted title="Удалено, в среднем"/>
<BigValue data={per_changeset} value=avg_keys title="Ключей, в среднем"/>

## Ключи

```sql top_keys
select key, count(*) as changesets, count(distinct uid) as users
from osm.tag_changes
group by key
order by changesets desc
limit 25
```

<BarChart data={top_keys} x=key y=changesets swapXY=true title="Топ ключей по числу чейнджсетов" sort=false/>

Подробнее — на странице [Ключи](/keys). Пользователи — на странице [Пользователи](/users).

## Где редактируют

```sql points
select lat, lon, "user", edits from osm.changesets where lat is not null
```

<PointMap data={points} lat=lat long=lon pointName=user value=edits height=450/>
