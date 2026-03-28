import { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { T } from '../styles/tokens';
import {
  plants,
  distributionCenters,
  suppliers as rawSuppliers,
  lanes as rawLanes,
  products,
  plantProductSourcing,
} from '../../server/src/data/synthetic-network.js';

// Build unified location list from separate arrays (for Leaflet map)
const networkLocations = [
  ...plants.map(p => ({ code: p.code, type: 'plant', lat: p.lat, lng: p.lon, city: p.city, state: p.state, weeklyCapacity: null })),
  ...distributionCenters.map(d => ({ code: d.code, type: 'dc', lat: d.lat, lng: d.lon, city: d.city, state: d.state })),
  ...rawSuppliers.map(s => ({ code: s.code, type: 'supplier', lat: s.city === 'Fresno' ? 36.74 : s.city === 'Des Moines' ? 41.59 : 33.52, lng: s.city === 'Fresno' ? -119.77 : s.city === 'Des Moines' ? -93.61 : -86.80, city: s.city, state: s.state })),
];

// Build unified lane list with source/dest/laneType format
const networkLanes = rawLanes.map(l => ({
  source: l.from,
  dest: l.to,
  laneType: l.from.startsWith('SUP') ? 'inbound' : 'outbound',
  leadTimeDays: l.leadTimeDays,
  costPerLb: l.costPerLb,
}));

const TYPE_CONFIG = {
  supplier: { color: '#7C3AED', label: 'Supplier', symbol: '▲' },
  plant:    { color: '#D97706', label: 'Plant',    symbol: '■' },
  dc:       { color: '#059669', label: 'DC',       symbol: '●' },
};

const LANE_STYLES = {
  inbound:  { color: '#7C3AED', dash: '8, 5', weight: 1.8, opacity: 0.35, hoverOpacity: 0.8, hoverWeight: 2.5 },
  outbound: { color: '#059669', dash: null,    weight: 1.8, opacity: 0.35, hoverOpacity: 0.8, hoverWeight: 2.5 },
};

function createMarkerIcon(type, highlighted = false) {
  const cfg = TYPE_CONFIG[type];
  const size = highlighted ? 32 : 24;
  const fontSize = highlighted ? 16 : 12;
  const shadow = highlighted ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.2)';

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    html: `<div style="
      width:${size}px; height:${size}px;
      display:flex; align-items:center; justify-content:center;
      font-size:${fontSize}px; color:${cfg.color};
      background:white; border:2px solid ${cfg.color};
      border-radius:${type === 'dc' ? '50%' : type === 'plant' ? '4px' : '50%'};
      box-shadow:${shadow};
      transition: all 0.15s ease;
      cursor:pointer;
    ">${cfg.symbol}</div>`,
  });
}

export default function NetworkMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredLoc, setHoveredLoc] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const lanesRef = useRef([]);

  useEffect(() => {
    fetch('/api/network/topology')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => {
        setData({
          locations: networkLocations,
          lanes: networkLanes,
          products,
          productSourcing: plantProductSourcing,
          suppliers: rawSuppliers.map(s => {
            const loc = networkLocations.find(l => l.code === s.code);
            return { ...s, ...(loc ? { lat: loc.lat, lng: loc.lng } : {}) };
          }),
        });
        setLoading(false);
      });
  }, []);

  // Build location lookup
  const locationMap = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(data.locations.map(l => [l.code, l]));
  }, [data]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!data || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: false,
    });

    // CartoDB Positron — clean, professional, free, no API key
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Small zoom control bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Attribution bottom-left, minimal
    L.control.attribution({ position: 'bottomleft', prefix: false })
      .addAttribution('© <a href="https://carto.com">CARTO</a> © <a href="https://osm.org">OSM</a>')
      .addTo(map);

    // Draw lanes
    const { locations, lanes } = data;
    const locLookup = Object.fromEntries(locations.map(l => [l.code, l]));

    lanes.forEach(lane => {
      const src = locLookup[lane.source];
      const dst = locLookup[lane.dest];
      if (!src || !dst) return;

      const style = LANE_STYLES[lane.laneType] || LANE_STYLES.outbound;
      const polyline = L.polyline(
        [[src.lat, src.lng], [dst.lat, dst.lng]],
        {
          color: style.color,
          weight: style.weight,
          opacity: style.opacity,
          dashArray: style.dash,
          className: '',
        }
      ).addTo(map);

      lanesRef.current.push({
        polyline,
        source: lane.source,
        dest: lane.dest,
        laneType: lane.laneType,
      });
    });

    // Draw markers on top
    locations.forEach(loc => {
      const marker = L.marker([loc.lat, loc.lng], {
        icon: createMarkerIcon(loc.type),
        zIndexOffset: loc.type === 'dc' ? 300 : loc.type === 'plant' ? 200 : 100,
      }).addTo(map);

      // Tooltip
      const cfg = TYPE_CONFIG[loc.type];
      marker.bindTooltip(
        `<div style="font-family:Sora,sans-serif;font-size:12px;font-weight:600;color:${T.ink};margin-bottom:2px">${loc.code}</div>
         <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.inkMid}">${loc.city}, ${loc.state}</div>
         <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${cfg.color};margin-top:3px">${cfg.label}${loc.weeklyCapacity ? ` · ${loc.weeklyCapacity} units/wk` : ''}</div>`,
        {
          direction: 'top',
          offset: [0, -14],
          className: 'network-map-tooltip',
        }
      );

      marker.on('mouseover', () => {
        setHoveredLoc(loc.code);
      });
      marker.on('mouseout', () => {
        setHoveredLoc(null);
      });

      markersRef.current[loc.code] = { marker, type: loc.type };
    });

    // Fit bounds to all locations with padding
    const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      lanesRef.current = [];
    };
  }, [data]);

  // Update lane + marker styles on hover
  useEffect(() => {
    // Update lanes
    lanesRef.current.forEach(({ polyline, source, dest, laneType }) => {
      const style = LANE_STYLES[laneType] || LANE_STYLES.outbound;
      const isHighlighted = hoveredLoc && (hoveredLoc === source || hoveredLoc === dest);

      polyline.setStyle({
        weight: isHighlighted ? style.hoverWeight : style.weight,
        opacity: isHighlighted ? style.hoverOpacity : style.opacity,
      });

      if (isHighlighted) {
        polyline.bringToFront();
      }
    });

    // Update markers
    Object.entries(markersRef.current).forEach(([code, { marker, type }]) => {
      const isHighlighted = hoveredLoc === code;
      marker.setIcon(createMarkerIcon(type, isHighlighted));
      if (isHighlighted) marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(type === 'dc' ? 300 : type === 'plant' ? 200 : 100);
    });
  }, [hoveredLoc]);

  if (loading) {
    return (
      <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '24px 28px' }}>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 16 }}>Distribution Network</div>
        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, borderRadius: 8 }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.inkLight }}>Loading network topology...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '24px 28px' }}>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 16 }}>Distribution Network</div>
        <div style={{ padding: 24, background: T.riskBg, borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12, color: T.risk }}>
          Failed to load network: {error}
        </div>
      </div>
    );
  }

  const { locations, lanes } = data;

  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 4 }}>Distribution Network</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, letterSpacing: 0.8 }}>
            {locations.filter(l => l.type === 'supplier').length} suppliers
            {' \u00B7 '}
            {locations.filter(l => l.type === 'plant').length} plants
            {' \u00B7 '}
            {locations.filter(l => l.type === 'dc').length} DCs
            {' \u00B7 '}
            {lanes.length} lanes
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: cfg.color, fontSize: 14, fontWeight: 700 }}>{cfg.symbol}</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, letterSpacing: 0.5 }}>
                {cfg.label}
              </span>
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width={20} height={8} viewBox="0 0 20 8">
              <line x1={0} y1={4} x2={20} y2={4} stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="4,3" />
            </svg>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, letterSpacing: 0.5 }}>Inbound</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width={20} height={8} viewBox="0 0 20 8">
              <line x1={0} y1={4} x2={20} y2={4} stroke="#059669" strokeWidth={1.5} />
            </svg>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, letterSpacing: 0.5 }}>Outbound</span>
          </div>
        </div>
      </div>

      {/* Leaflet Map */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: 420,
          borderRadius: 8,
          overflow: 'hidden',
          border: `1px solid ${T.border}`,
        }}
      />

      {/* Bottom info */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        gap: 24,
        paddingTop: 12,
        borderTop: `1px solid ${T.border}`,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>
          <span style={{ color: '#7C3AED' }}>- - -</span> Supplier → Plant
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>
          <span style={{ color: '#059669' }}>&mdash;&mdash;</span> Plant → DC
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkGhost }}>
          Hover locations to highlight connected lanes
        </div>
      </div>

      {/* Tooltip custom styles */}
      <style>{`
        .network-map-tooltip {
          background: white !important;
          border: 1px solid ${T.border} !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          font-family: 'JetBrains Mono', monospace;
        }
        .network-map-tooltip::before {
          border-top-color: ${T.border} !important;
        }
        .leaflet-container {
          background: ${T.bg} !important;
          font-family: 'JetBrains Mono', monospace !important;
        }
        .leaflet-control-zoom a {
          background: white !important;
          color: ${T.ink} !important;
          border-color: ${T.border} !important;
          font-family: 'JetBrains Mono', monospace !important;
        }
        .leaflet-control-attribution {
          font-size: 9px !important;
          color: ${T.inkGhost} !important;
          background: rgba(255,255,255,0.7) !important;
        }
        .leaflet-control-attribution a {
          color: ${T.inkLight} !important;
        }
      `}</style>
    </div>
  );
}
