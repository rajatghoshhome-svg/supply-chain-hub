import { useState, useEffect, useMemo } from 'react';
import { T } from '../styles/tokens';

// Continental US bounding box
const LAT_MIN = 24.5;
const LAT_MAX = 49.5;
const LNG_MIN = -125;
const LNG_MAX = -66;

// SVG viewport
const SVG_W = 900;
const SVG_H = 560;
const PAD = 40;

// Equirectangular projection: lat/lng -> SVG x/y
function project(lat, lng) {
  const x = PAD + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (SVG_W - 2 * PAD);
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (SVG_H - 2 * PAD);
  return [x, y];
}

const TYPE_CONFIG = {
  supplier: { color: '#7C3AED', label: 'Supplier', shape: 'triangle' },
  plant:    { color: '#D97706', label: 'Plant',    shape: 'square' },
  dc:       { color: '#059669', label: 'DC',       shape: 'circle' },
};

const LANE_COLORS = {
  inbound:  'rgba(124, 58, 237, 0.18)',
  outbound: 'rgba(5, 150, 105, 0.22)',
};

function LocationMarker({ x, y, type, code, city, state, hovered, onHover, onLeave }) {
  const cfg = TYPE_CONFIG[type];
  const size = hovered ? 9 : 7;

  let shape;
  if (cfg.shape === 'triangle') {
    const h = size * 1.7;
    const pts = `${x},${y - h / 2} ${x - size},${y + h / 2} ${x + size},${y + h / 2}`;
    shape = <polygon points={pts} fill={cfg.color} stroke={T.white} strokeWidth={1.5} />;
  } else if (cfg.shape === 'square') {
    shape = <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={2} fill={cfg.color} stroke={T.white} strokeWidth={1.5} />;
  } else {
    shape = <circle cx={x} cy={y} r={size} fill={cfg.color} stroke={T.white} strokeWidth={1.5} />;
  }

  return (
    <g
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(code)}
      onMouseLeave={onLeave}
    >
      {shape}
      {hovered && (
        <g>
          {/* Tooltip background */}
          <rect
            x={x + 12}
            y={y - 24}
            width={Math.max((city + ', ' + state).length, code.length) * 7.2 + 16}
            height={38}
            rx={5}
            fill={T.ink}
            opacity={0.92}
          />
          <text x={x + 20} y={y - 8} fontFamily="Sora" fontSize={11} fontWeight={600} fill={T.white}>
            {code}
          </text>
          <text x={x + 20} y={y + 6} fontFamily="JetBrains Mono" fontSize={9.5} fill="rgba(255,255,255,0.7)">
            {city}, {state}
          </text>
        </g>
      )}
    </g>
  );
}

// Simplified US continental border outline (generalized path)
const US_OUTLINE = `M 68,155 L 73,140 82,128 95,120 108,115 120,108 130,96 142,88 158,84 175,82
  190,78 210,74 230,72 250,72 268,74 285,78 300,76 315,72 330,68 345,64
  360,60 375,58 390,56 410,55 430,54 450,55 468,58 485,62 500,58 515,52
  530,48 545,46 560,48 575,52 590,56 605,58 618,54 632,50 648,48 665,50
  680,55 695,58 710,60 725,62 740,66 755,72 768,78 778,86 785,96 790,108
  795,118 798,130 800,142 802,156 800,170 795,185 788,198 780,210 775,225
  778,240 782,255 785,268 780,282 772,295 762,308 750,318 738,330 725,340
  715,348 705,358 698,370 695,382 690,395 682,405 670,412 655,415 640,420
  625,428 610,435 595,440 578,442 560,440 545,435 530,432 515,435 498,438
  480,442 462,445 445,448 428,450 410,452 392,450 375,448 358,445 340,442
  322,440 305,438 288,435 270,432 252,430 235,432 218,435 200,438 182,442
  165,445 148,448 132,452 118,456 105,460 92,458 82,452 75,442 70,428
  68,412 65,395 62,378 60,360 58,342 56,325 55,308 56,290 58,272 60,255
  62,238 64,220 66,202 66,185 67,170 68,155 Z`;

export default function NetworkMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredLoc, setHoveredLoc] = useState(null);

  useEffect(() => {
    fetch('/api/network/topology')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Build location lookup for lane drawing
  const locationMap = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(data.locations.map(l => [l.code, l]));
  }, [data]);

  if (loading) {
    return (
      <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '24px 28px' }}>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 16 }}>Distribution Network</div>
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

  // Separate by type for layering (draw lanes first, then markers)
  const sortedLocations = [...locations].sort((a, b) => {
    const order = { supplier: 0, plant: 1, dc: 2 };
    return (order[a.type] ?? 3) - (order[b.type] ?? 3);
  });

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
              <svg width={14} height={14} viewBox="0 0 14 14">
                {cfg.shape === 'triangle' && (
                  <polygon points="7,2 2,12 12,12" fill={cfg.color} />
                )}
                {cfg.shape === 'square' && (
                  <rect x={2} y={2} width={10} height={10} rx={1.5} fill={cfg.color} />
                )}
                {cfg.shape === 'circle' && (
                  <circle cx={7} cy={7} r={5} fill={cfg.color} />
                )}
              </svg>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, letterSpacing: 0.5 }}>
                {cfg.label}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width={20} height={14} viewBox="0 0 20 14">
              <line x1={0} y1={7} x2={20} y2={7} stroke={T.inkGhost} strokeWidth={1.5} strokeDasharray="3,2" />
            </svg>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, letterSpacing: 0.5 }}>Lane</span>
          </div>
        </div>
      </div>

      {/* Map SVG */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background */}
          <rect width={SVG_W} height={SVG_H} fill={T.bg} rx={8} />

          {/* Subtle grid */}
          {Array.from({ length: 11 }, (_, i) => {
            const x = PAD + (i / 10) * (SVG_W - 2 * PAD);
            return <line key={`vg${i}`} x1={x} y1={PAD} x2={x} y2={SVG_H - PAD} stroke={T.border} strokeWidth={0.5} opacity={0.5} />;
          })}
          {Array.from({ length: 7 }, (_, i) => {
            const y = PAD + (i / 6) * (SVG_H - 2 * PAD);
            return <line key={`hg${i}`} x1={PAD} y1={y} x2={SVG_W - PAD} y2={y} stroke={T.border} strokeWidth={0.5} opacity={0.5} />;
          })}

          {/* US outline */}
          <path
            d={US_OUTLINE}
            fill="none"
            stroke={T.borderMid}
            strokeWidth={1.2}
            opacity={0.45}
            transform={`translate(${PAD - 20}, ${PAD - 30}) scale(${(SVG_W - 2 * PAD + 40) / 860}, ${(SVG_H - 2 * PAD + 60) / 510})`}
          />

          {/* Lanes */}
          {lanes.map((lane, i) => {
            const src = locationMap[lane.source];
            const dst = locationMap[lane.dest];
            if (!src || !dst) return null;
            const [x1, y1] = project(src.lat, src.lng);
            const [x2, y2] = project(dst.lat, dst.lng);
            const isHighlighted = hoveredLoc === lane.source || hoveredLoc === lane.dest;
            return (
              <line
                key={`lane-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isHighlighted ? (lane.laneType === 'inbound' ? '#7C3AED' : '#059669') : (LANE_COLORS[lane.laneType] || T.inkGhost)}
                strokeWidth={isHighlighted ? 2 : 1}
                opacity={isHighlighted ? 0.7 : 0.4}
                strokeDasharray={lane.laneType === 'inbound' ? '6,3' : 'none'}
              />
            );
          })}

          {/* Location markers */}
          {sortedLocations.map(loc => {
            const [x, y] = project(loc.lat, loc.lng);
            return (
              <LocationMarker
                key={loc.code}
                x={x}
                y={y}
                type={loc.type}
                code={loc.code}
                city={loc.city}
                state={loc.state}
                hovered={hoveredLoc === loc.code}
                onHover={setHoveredLoc}
                onLeave={() => setHoveredLoc(null)}
              />
            );
          })}

          {/* Permanent labels (small, below markers) */}
          {sortedLocations.map(loc => {
            const [x, y] = project(loc.lat, loc.lng);
            if (hoveredLoc === loc.code) return null; // tooltip replaces label
            return (
              <text
                key={`label-${loc.code}`}
                x={x}
                y={y + 18}
                textAnchor="middle"
                fontFamily="JetBrains Mono"
                fontSize={8}
                fill={T.inkLight}
                pointerEvents="none"
              >
                {loc.city}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Bottom info row */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        gap: 24,
        paddingTop: 12,
        borderTop: `1px solid ${T.border}`,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>
          <span style={{ color: '#7C3AED' }}>---</span> Inbound (supplier to plant)
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>
          <span style={{ color: '#059669' }}>&mdash;&mdash;</span> Outbound (plant to DC)
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkGhost }}>
          Hover locations to highlight connected lanes
        </div>
      </div>
    </div>
  );
}
