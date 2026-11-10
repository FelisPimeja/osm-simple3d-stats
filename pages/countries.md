---
title: Страны
---

Страна чейнджсета — по центру его bbox (границы Natural Earth 1:50m). Чейнджсет, охватывающий несколько стран, засчитывается одной.

```sql by_country
select
  country,
  count(distinct uid) as users,
  count(*) as changesets,
  sum(edits) as edits,
  sum(created) as created,
  sum(modified) as modified,
  sum(deleted) as deleted,
  count(distinct case when has_indoor then uid end) as indoor_users,
  count(case when has_indoor then 1 end) as indoor_changesets,
  max(day) as last_day
from osm.changesets
group by country
order by users desc, changesets desc
```

```sql top_countries
select * from ${by_country} limit 20
```

<BarChart data={top_countries} x=country y=users swapXY=true sort=false title="Пользователей (топ-20 стран)"/>

<BarChart data={top_countries} x=country y=changesets swapXY=true sort=false title="Чейнджсетов (топ-20 стран)"/>

<BarChart data={top_countries} x=country y={["created", "modified", "deleted"]} swapXY=true sort=false title="Объектов: создано / изменено / удалено (топ-20 стран)"/>

<DataTable data={by_country} search=true rows=50>
  <Column id=country title="Страна"/>
  <Column id=users title="Пользователей"/>
  <Column id=changesets title="Чейнджсетов"/>
  <Column id=edits title="Объектов"/>
  <Column id=created title="Создано"/>
  <Column id=modified title="Изменено"/>
  <Column id=deleted title="Удалено"/>
  <Column id=indoor_users title="Пользователей Indoor"/>
  <Column id=indoor_changesets title="Чейнджсетов Indoor"/>
  <Column id=last_day title="Последний"/>
</DataTable>

## По неделям

```sql weekly
with top as (select country from ${by_country} limit 8)
select
  date_trunc('week', day) as week,
  case when country in (select country from top) then country else 'Другие' end as country,
  count(*) as changesets,
  count(distinct uid) as users
from osm.changesets
group by all
order by week
```

<BarChart data={weekly} x=week y=users series=country title="Активных пользователей в неделю по странам"/>

<BarChart data={weekly} x=week y=changesets series=country title="Чейнджсетов в неделю по странам"/>
