---
title: Пользователи
---

```sql users
select
  "user",
  'https://www.openstreetmap.org/user/' || "user" as profile,
  count(*) as changesets,
  sum(edits) as edits,
  sum(created) as created,
  sum(modified) as modified,
  count(distinct day) as active_days,
  min(day) as first_day,
  max(day) as last_day
from osm.changesets
group by "user"
order by changesets desc
```

<DataTable data={users} search=true rows=50>
  <Column id=user title="Пользователь"/>
  <Column id=profile contentType=link linkLabel="OSM" title="Профиль" openInNewTab=true/>
  <Column id=changesets title="Чейнджсетов"/>
  <Column id=edits title="Объектов"/>
  <Column id=created/>
  <Column id=modified/>
  <Column id=active_days title="Активных дней"/>
  <Column id=first_day title="Первый"/>
  <Column id=last_day title="Последний"/>
</DataTable>

```sql retention
with per_user as (select uid, count(distinct day) as d from osm.changesets group by uid)
select
  case when d = 1 then '1 день' when d <= 3 then '2–3 дня' when d <= 7 then '4–7 дней' else '8+ дней' end as active,
  min(d) as ord,
  count(*) as users
from per_user group by active order by ord
```

<BarChart data={retention} x=active y=users sort=false title="Пользователи по числу активных дней"/>

## Последние чейнджсеты

```sql recent
select
  id,
  'https://osmcha.org/changesets/' || id as osmcha,
  created_at, "user", comment, created, modified, deleted
from osm.changesets order by created_at desc limit 100
```

<DataTable data={recent} rows=25>
  <Column id=osmcha contentType=link linkLabel=id title="Чейнджсет" openInNewTab=true/>
  <Column id=created_at fmt="yyyy-mm-dd H:MM"/>
  <Column id=user/>
  <Column id=comment/>
  <Column id=created/>
  <Column id=modified/>
  <Column id=deleted/>
</DataTable>
