import { T } from '../../styles/tokens';

export default function LoadSlot({ load, onCommit, onRemove, onDrop, readOnly = false }) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const shipmentId = e.dataTransfer.getData('text/plain');
    if (shipmentId && onDrop) {
      onDrop(shipmentId, load);
    }
  };

  const utilPct = load.maxWeight ? Math.round((load.totalWeight / load.maxWeight) * 100) : 0;
  const utilColor = utilPct > 95 ? T.risk : utilPct > 75 ? T.warn : T.safe;

  return (
    <div
      onDragOver={readOnly ? undefined : handleDragOver}
      onDrop={readOnly ? undefined : handleDrop}
      style={{
        background: T.white,
        border: `1.5px ${readOnly ? 'solid' : 'dashed'} ${readOnly ? T.safe : T.border}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        flex: '0 0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, color: T.ink }}>
          {load.loadId || load.id}
        </span>
        <span style={{ fontSize: 10, fontFamily: T.fontMono, color: utilColor, fontWeight: 600 }}>
          {utilPct}%
        </span>
      </div>

      <div style={{
        height: 4,
        background: T.bgDark,
        borderRadius: 2,
        marginBottom: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(utilPct, 100)}%`,
          background: utilColor,
          borderRadius: 2,
          transition: 'width 0.2s',
        }} />
      </div>

      <div style={{ fontSize: 11, color: T.inkMid, fontFamily: T.fontBody, marginBottom: 4 }}>
        {load.shipmentCount || load.shipments?.length || 0} shipments ·{' '}
        {(load.totalWeight || 0).toLocaleString()} lbs
      </div>

      {load.lane && (
        <div style={{ fontSize: 11, color: T.inkLight, fontFamily: T.fontBody, marginBottom: 8 }}>
          {load.lane}
        </div>
      )}

      {readOnly && load.committedAt && (
        <div style={{ fontSize: 10, color: T.safe, fontFamily: T.fontMono, marginTop: 4 }}>
          Committed {new Date(load.committedAt).toLocaleString()}
        </div>
      )}

      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {onCommit && (
            <button
              onClick={() => onCommit(load)}
              style={{
                flex: 1,
                background: T.safe,
                color: T.white,
                border: 'none',
                borderRadius: 4,
                padding: '5px 0',
                fontSize: 11,
                fontFamily: T.fontBody,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Commit
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(load)}
              style={{
                flex: 1,
                background: 'none',
                color: T.risk,
                border: `1px solid ${T.riskBorder}`,
                borderRadius: 4,
                padding: '5px 0',
                fontSize: 11,
                fontFamily: T.fontBody,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
