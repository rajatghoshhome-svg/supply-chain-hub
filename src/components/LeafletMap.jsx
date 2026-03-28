import { useState, useEffect, useRef } from 'react';
import { T } from '../styles/tokens';
import { DCS, CC } from '../data/dcs';

export default function LeafletMap({ navigate }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const [tip, setTip] = useState({ visible: false, x: 0, y: 0, dc: null });

  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => init();
    document.head.appendChild(s);
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  const init = () => {
    if (!mapRef.current || mapInst.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [38.5, -96], zoom: 4, zoomControl: true, scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    // Routes
    L.polyline([[35.15, -90.05], [33.75, -84.39]], { color: T.risk, weight: 2.5, opacity: 0.8, dashArray: '8,5' }).addTo(map);
    L.polyline([[35.15, -90.05], [35.23, -80.84]], { color: T.warn, weight: 2, opacity: 0.7, dashArray: '6,6' }).addTo(map);

    const li = (text, color) => L.divIcon({ className: '', html: `<div style="font-family:JetBrains Mono,monospace;font-size:10px;font-weight:600;color:${color};background:rgba(247,246,243,0.92);padding:3px 8px;border-radius:5px;border:1px solid ${color}55;white-space:nowrap;">${text}</div>`, iconAnchor: [40, 10] });
    L.marker([34.1, -87.3], { icon: li('ACT NOW · 36hr', T.risk) }).addTo(map);
    L.marker([35.8, -82.5], { icon: li('REVIEW', T.warn) }).addTo(map);

    // DC markers with pie chart SVGs
    DCS.forEach(dc => {
      const sz = dc.status === 'crisis' ? 58 : 48;
      let a = -90;
      const paths = dc.customers.map(c => {
        const angle = (c.pct / 100) * 360;
        const end = a + angle;
        const r = sz / 2 - 2, cx = sz / 2, cy = sz / 2;
        const x1 = cx + r * Math.cos(a * Math.PI / 180), y1 = cy + r * Math.sin(a * Math.PI / 180);
        const x2 = cx + r * Math.cos(end * Math.PI / 180), y2 = cy + r * Math.sin(end * Math.PI / 180);
        const lg = angle > 180 ? 1 : 0;
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
        a = end;
        return `<path d="${d}" fill="${CC[c.name] || T.other}" stroke="white" stroke-width="0.8"/>`;
      }).join('');

      const bw = dc.status === 'crisis' ? 3 : 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
        <filter id="ds"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.2)"/></filter>
        <circle cx="${sz / 2}" cy="${sz / 2}" r="${sz / 2}" fill="white" filter="url(#ds)"/>
        ${paths}
        <circle cx="${sz / 2}" cy="${sz / 2}" r="${sz / 2 - 2}" fill="none" stroke="${dc.color}" stroke-width="${bw}"/>
        <text x="${sz / 2}" y="${sz / 2 + 4}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700" fill="${dc.color}">${dc.id}</text>
      </svg>`;

      const icon = L.icon({ iconUrl: 'data:image/svg+xml;base64,' + btoa(svg), iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] });
      const m = L.marker([dc.lat, dc.lng], { icon, zIndexOffset: dc.status === 'crisis' ? 1000 : 0 }).addTo(map);

      const lbl = L.divIcon({ className: '', html: `<div style="font-family:Inter,sans-serif;font-size:10px;font-weight:600;color:${dc.color};text-align:center;white-space:nowrap;margin-top:${sz / 2 + 6}px;text-shadow:0 1px 3px rgba(255,255,255,0.95),0 -1px 3px rgba(255,255,255,0.95),1px 0 3px rgba(255,255,255,0.95),-1px 0 3px rgba(255,255,255,0.95);">${dc.city}</div>`, iconAnchor: [30, 0] });
      L.marker([dc.lat, dc.lng], { icon: lbl, interactive: false }).addTo(map);

      m.on('mouseover', () => {
        const pt = map.latLngToContainerPoint([dc.lat, dc.lng]);
        setTip({ visible: true, x: pt.x, y: pt.y, dc });
      });
      m.on('mouseout', () => setTip({ visible: false, x: 0, y: 0, dc: null }));
      m.on('click', () => navigate && navigate('/drp'));
    });

    mapInst.current = map;
  };

  return (
    <div style={{ position: 'relative', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ height: 440, width: '100%' }} />

      {/* Customer legend */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 500, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {Object.entries(CC).filter(([k]) => k !== 'Other').map(([name, col]) => (
          <div key={name} style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${T.border}`, borderRadius: 5, padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: col }} />
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: T.inkMid, fontWeight: 500 }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Status legend */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 500, display: 'flex', gap: 5 }}>
        {[[T.risk, 'Crisis'], [T.warn, 'Review/Overstock'], [T.accent, 'Transfer hub'], [T.inkLight, 'Stable']].map(([c, l]) => (
          <div key={l} style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${T.border}`, borderRadius: 5, padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tip.visible && tip.dc && (
        <div className="fade" style={{ position: 'absolute', left: Math.min(tip.x + 18, 580), top: Math.max(tip.y - 170, 8), zIndex: 600, background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', minWidth: 234, boxShadow: '0 8px 28px rgba(0,0,0,0.13)', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: tip.dc.color, letterSpacing: 1, marginBottom: 2, textTransform: 'uppercase' }}>{tip.dc.id} — {tip.dc.city}</div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 12.5, color: T.ink }}>{tip.dc.statusLabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 18, color: tip.dc.color, lineHeight: 1 }}>{tip.dc.daysSupply.toFixed(1)}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: T.inkLight, letterSpacing: 0.5 }}>DAYS SUPPLY</div>
            </div>
          </div>
          {tip.dc.customers.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: CC[c.name], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: c.atRisk ? T.risk : T.ink }}>{c.name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: c.atRisk ? T.risk : T.inkLight }}>{c.units.toLocaleString()}</span>
                </div>
                <div style={{ height: 3, background: T.bgDark, borderRadius: 2, marginTop: 2 }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', background: c.atRisk ? T.risk : CC[c.name], borderRadius: 2, opacity: c.atRisk ? 1 : 0.6 }} />
                </div>
              </div>
              {c.atRisk && <span style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: T.risk, fontWeight: 700 }}>RISK</span>}
            </div>
          ))}
          <div style={{ marginTop: 8, background: T.bgDark, borderRadius: 6, padding: '7px 10px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight }}>Fill Rate</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 600, color: tip.dc.fillRate < 85 ? T.risk : tip.dc.fillRate < 95 ? T.warn : T.safe }}>{tip.dc.fillRate}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
