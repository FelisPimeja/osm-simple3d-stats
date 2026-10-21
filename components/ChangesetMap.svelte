<!-- Changeset centroids on OpenFreeMap vector tiles (positron / dark), sized by number of edited objects. -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';

  export let data;
  export let height = 450;

  const STYLES = {
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://tiles.openfreemap.org/styles/dark',
  };

  let container;
  let map;
  let maplibre;
  let observer;
  let fitted = false;

  const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  // Evidence passes a Query store that fills in after the page renders.
  let rows = [];
  let unsubscribe;
  $: {
    unsubscribe?.();
    unsubscribe = undefined;
    if (data?.subscribe) {
      unsubscribe = data.subscribe((v) => (rows = Array.from(v ?? [])));
      data.fetch?.();
    } else rows = Array.from(data ?? []);
  }
  $: geojson = {
    type: 'FeatureCollection',
    features: rows
      .filter((r) => r.lat != null && r.lon != null)
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        properties: { id: r.id, user: r.user, edits: r.edits, day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day ?? '').slice(0, 10) },
      })),
  };
  $: if (map) render(geojson);

  function addLayers() {
    if (!map.getSource('changesets')) map.addSource('changesets', { type: 'geojson', data: geojson });
    if (!map.getLayer('changesets')) {
      map.addLayer({
        id: 'changesets',
        type: 'circle',
        source: 'changesets',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'edits']], 1, 3, 10, 9, 30, 18],
          'circle-color': '#2563eb',
          'circle-opacity': 0.55,
          'circle-stroke-color': '#1e3a8a',
          'circle-stroke-width': 1,
        },
      });
    }
  }

  function render(fc) {
    if (!map.isStyleLoaded()) {
      map.once('idle', () => render(geojson));
      return;
    }
    addLayers();
    map.getSource('changesets').setData(fc);
    if (!fitted && fc.features.length) {
      const b = new maplibre.LngLatBounds();
      fc.features.forEach((f) => b.extend(f.geometry.coordinates));
      map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 0 });
      fitted = true;
    }
  }

  onMount(async () => {
    maplibre = (await import('maplibre-gl')).default;
    map = new maplibre.Map({ container, style: STYLES[theme()], center: [20, 45], zoom: 2, attributionControl: { compact: true } });
    map.addControl(new maplibre.NavigationControl({ showCompass: false }));
    map.on('style.load', () => render(geojson));
    map.on('mouseenter', 'changesets', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'changesets', () => (map.getCanvas().style.cursor = ''));
    map.on('click', 'changesets', (e) => {
      const p = e.features[0].properties;
      new maplibre.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          `<b>${p.user}</b><br>${p.day} · ${p.edits} obj.<br><a href="https://osmcha.org/changesets/${p.id}" target="_blank" rel="noopener">OSMCha ${p.id}</a>`,
        )
        .addTo(map);
    });
    // Evidence sets data-theme after mount; restyle only on a real change, without diffing so style.load re-adds our layer.
    let current = theme();
    observer = new MutationObserver(() => {
      if (theme() === current) return;
      current = theme();
      map.setStyle(STYLES[current], { diff: false });
    });
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  });

  onDestroy(() => {
    unsubscribe?.();
    observer?.disconnect();
    map?.remove();
  });
</script>

<div bind:this={container} class="changeset-map" style="height: {height}px"></div>

<style>
  .changeset-map {
    width: 100%;
    border-radius: 6px;
    overflow: hidden;
    margin: 1rem 0;
  }
  :global(.changeset-map .maplibregl-popup-content) {
    color: #111;
    font-size: 13px;
  }
</style>
