import { T } from '../../styles/tokens';

export default function LaneSelector({ lanes, activeLane, onSelect, filterSTO = false }) {
  const filtered = filterSTO ? (lanes || []).filter(l => l.type !== 'STO') : (lanes || []);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {filtered.map(lane => {
        const active = activeLane === lane.id;
        return (
          <button
            key={lane.id}
            onClick={() => onSelect(lane.id)}
            style={{
              background: active ? T.modDrp : T.white,
              color: active ? T.white : T.ink,
              border: `1px solid ${active ? T.modDrp : T.border}`,
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: T.fontBody,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {lane.from} → {lane.to}
          </button>
        );
      })}
    </div>
  );
}
