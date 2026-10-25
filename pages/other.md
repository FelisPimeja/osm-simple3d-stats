---
title: OpenHistoricalMap и OpenGeofiction
---

Чейнджсеты osm-simple3d-editor (и JOSM с `#simple3d`) в [OpenHistoricalMap](https://www.openhistoricalmap.org) и [OpenGeofiction](https://opengeofiction.net), с 10.10.2026 — с появления в редакторе этих серверов. OSMCha для них нет, поэтому данные проще: OHM — из [ежедневного дампа чейнджсетов](https://planet.openhistoricalmap.org/?prefix=planet/changesets/), OGF — из API (`/changesets` по времени). Изменённых тегов нет — только число правок. Текущие сутки UTC не показываются.

```sql totals
select
  project,
  count(*) as changesets,
  count(distinct uid) as users,
  sum(changes) as changes,
  max(created_at) as last_changeset
from osm.other_projects
group by project
order by project
```

<DataTable data={totals}>
  <Column id=project title="Проект"/>
  <Column id=changesets title="Чейнджсетов"/>
  <Column id=users title="Пользователей"/>
  <Column id=changes title="Правок"/>
  <Column id=last_changeset title="Последний" fmt="yyyy-mm-dd H:MM"/>
</DataTable>

```sql daily
select day, project, count(*) as changesets
from osm.other_projects
group by all
order by day
```

<BarChart data={daily} x=day y=changesets series=project title="Чейнджсеты в сутки"/>

```sql users
select
  project,
  "user",
  case project
    when 'OpenHistoricalMap' then 'https://www.openhistoricalmap.org/user/'
    else 'https://opengeofiction.net/user/'
  end || "user" as profile,
  count(*) as changesets,
  sum(changes) as changes,
  min(day) as first_day,
  max(day) as last_day
from osm.other_projects
group by all
order by changesets desc
```

<DataTable data={users} rows=50>
  <Column id=project title="Проект"/>
  <Column id=user title="Пользователь"/>
  <Column id=profile contentType=link linkLabel="Профиль" title="Профиль" openInNewTab=true/>
  <Column id=changesets title="Чейнджсетов"/>
  <Column id=changes title="Правок"/>
  <Column id=first_day title="Первый"/>
  <Column id=last_day title="Последний"/>
</DataTable>
