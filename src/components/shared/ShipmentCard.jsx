import { T } from '../../styles/tokens';

export default function ShipmentCard({ shipment, selected, onClick, onShiftClick, draggable = false }) {
  const handleClick = (e) => {
    if (e.shiftKey && onShiftClick) {
      onShiftClick(shipment);
    } else if (onClick) {
      onClick(shipment);
    }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', shipment.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onClick={handleClick}
      style={{
        background: selected ? '#EBF2EE' : T.white,
        border: `1.5px solid ${selected ? T.modDrp : T.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.12s',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, color: T.ink }}>
          {shipment.id}
        </span>
        <span style={{
          fontSize: 10,
          fontFamily: T.fontMono,
          color: T.white,
          background: shipment.priority === 'high' ? T.risk : shipment.priority === 'medium' ? T.warn : T.inkLight,
          padding: '1px 6px',
          borderRadius: 3,
        }}>
          {shipment.priority || 'normal'}
        </span>
      </div>
      <div style={{ fontSize: 12, fontFamily: T.fontBody, color: T.ink, marginBottom: 2 }}>
        {shipment.sku || shipment.product}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: T.inkMid, fontFamily: T.fontBody }}>
          {shipment.qty?.toLocaleString() || '—'} {shipment.uom || 'lbs'}
        </span>
        <span style={{ fontSize: 11, color: T.inkLight, fontFamily: T.fontMono }}>
          {shipment.weight?.toLocaleString() || '—'} lbs
        </span>
      </div>
    </div>
  );
}
