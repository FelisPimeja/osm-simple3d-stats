---
title: Simple 3D и Simple Indoor
---

Чейнджсет относится к **Simple Indoor**, если в комментарии есть раздел редактора «Indoor plans» / «Поэтажные планы» или изменены ключи `indoor`, `level`, `repeat_on`, `door`, `room`; к **Simple 3D** — если изменены ключи формы здания (`height`, `building:levels`, `roof:*`, `building:part` и т. п.). Чейнджсеты с обоими — «Simple 3D + Indoor», без тех и других (OSMCha ещё не разобрал теги, только геометрия) — Simple 3D. Ключи появляются в данных OSMCha с задержкой, поэтому последние дни могут уточниться.

```sql by_kind
select
  kind,
  count(distinct uid) as users,
  count(*) as changesets,
  sum(edits) as edits,
  sum(created) as created,
  sum(modified) as modified,
  sum(deleted) as deleted
from osm.changesets
group by kind
order by kind
```

```sql totals
select
  count(distinct uid) as users,
  count(distinct case when has_indoor then uid end) as indoor_users,
  count(distinct case when has_indoor then uid end) / count(distinct uid) as indoor_share,
  count(case when has_indoor then 1 end) as indoor_changesets,
  sum(case when has_indoor then edits end) as indoor_edits
from osm.changesets
```

<BigValue data={totals} value=indoor_users title="Пользователей Indoor"/>
<BigValue data={totals} value=indoor_share fmt=pct1 title="Доля от всех пользователей"/>
<BigValue data={totals} value=indoor_changesets title="Чейнджсетов Indoor"/>
<BigValue data={totals} value=indoor_edits fmt=num0 title="Объектов в чейнджсетах Indoor"/>

<DataTable data={by_kind}>
  <Column id=kind title="Тип"/>
  <Column id=users title="Пользователей"/>
  <Column id=changesets title="Чейнджсетов"/>
  <Column id=edits title="Объектов"/>
  <Column id=created title="Создано"/>
  <Column id=modified title="Изменено"/>
  <Column id=deleted title="Удалено"/>
</DataTable>

## Динамика

```sql weekly
select
  date_trunc('week', day) as week,
  count(distinct case when has_indoor then uid end) as indoor_users,
  count(distinct case when not has_indoor then uid end) as only3d_users,
  count(case when has_indoor then 1 end) as indoor_changesets,
  count(case when not has_indoor then 1 end) as only3d_changesets
from osm.changesets
group by all
order by week
```

```sql indoor_cumulative
with first_seen as (
  select uid, min(day) as first_day from osm.changesets where has_indoor group by uid
)
select first_day as day, sum(count(*)) over (order by first_day) as indoor_users_total
from first_seen
group by first_day
order by day
```

<BarChart data={weekly} x=week y={["indoor_users", "only3d_users"]} title="Активных пользователей в неделю: Indoor / только 3D"/>

<BarChart data={weekly} x=week y={["indoor_changesets", "only3d_changesets"]} title="Чейнджсетов в неделю: Indoor / только 3D"/>

<AreaChart data={indoor_cumulative} x=day y=indoor_users_total title="Пользователей Indoor всего" step=true/>

## Кто редактирует планы этажей

```sql indoor_users
select
  "user",
  'https://www.openstreetmap.org/user/' || "user" as profile,
  count(case when has_indoor then 1 end) as indoor_changesets,
  sum(case when has_indoor then edits end) as indoor_edits,
  count(*) as changesets,
  string_agg(distinct case when has_indoor then country end, ', ') as countries,
  min(case when has_indoor then day end) as first_indoor,
  max(case when has_indoor then day end) as last_indoor
from osm.changesets
group by "user"
having count(case when has_indoor then 1 end) > 0
order by indoor_changesets desc
```

<DataTable data={indoor_users} search=true rows=50>
  <Column id=user title="Пользователь"/>
  <Column id=profile contentType=link linkLabel="OSM" title="Профиль" openInNewTab=true/>
  <Column id=indoor_changesets title="Чейнджсетов Indoor"/>
  <Column id=indoor_edits title="Объектов Indoor"/>
  <Column id=changesets title="Чейнджсетов всего"/>
  <Column id=countries title="Страны"/>
  <Column id=first_indoor title="Первый Indoor"/>
  <Column id=last_indoor title="Последний Indoor"/>
</DataTable>

## По странам

```sql kind_country
select
  country,
  count(distinct case when has_indoor then uid end) as indoor_users,
  count(distinct case when not has_indoor then uid end) as only3d_users,
  count(case when has_indoor then 1 end) as indoor_changesets,
  count(case when not has_indoor then 1 end) as only3d_changesets
from osm.changesets
group by country
having count(case when has_indoor then 1 end) > 0
order by indoor_changesets desc
```

<BarChart data={kind_country} x=country y={["indoor_changesets", "only3d_changesets"]} swapXY=true sort=false title="Чейнджсетов по странам (страны с Indoor)"/>

## Последние чейнджсеты Indoor

```sql recent
select
  created_at, "user", country, kind, edits, comment,
  'https://www.openstreetmap.org/changeset/' || id as link
from osm.changesets
where has_indoor
order by created_at desc
limit 50
```

<DataTable data={recent} rows=20>
  <Column id=created_at title="Когда" fmt="yyyy-mm-dd H:MM"/>
  <Column id=user title="Пользователь"/>
  <Column id=country title="Страна"/>
  <Column id=kind title="Тип"/>
  <Column id=edits title="Объектов"/>
  <Column id=comment title="Комментарий" wrap=true/>
  <Column id=link contentType=link linkLabel="OSM" title="Чейнджсет" openInNewTab=true/>
</DataTable>
