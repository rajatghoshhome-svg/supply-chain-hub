import { useState, useEffect } from 'react';
import { T } from '../../styles/tokens';

/**
 * HierarchyNav — Product/Customer hierarchy navigator
 *
 * Breadcrumb bar with drill-down capability.
 * Supports: By Product | By Customer | By Product × Customer
 */

const DIMENSION_LABELS = {
  product: 'By Product',
  customer: 'By Customer',
  'product-customer': 'By Product × Customer',
};

export default function HierarchyNav({ scope, onScopeChange, dimensions }) {
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [children, setChildren] = useState([]);
  const [dimension, setDimension] = useState('product');

  const { level = 'all', id = 'all', customer = null } = scope || {};

  // Fetch hierarchy data when scope changes
  useEffect(() => {
    fetch(`/api/demand/forecast?level=${level}&id=${id}${customer ? `&customer=${customer}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setBreadcrumb(data.breadcrumb || []);
        setChildren(data.children || []);
      })
      .catch(() => {});
  }, [level, id, customer]);

  const handleDrillDown = (child) => {
    onScopeChange({ level: child.level, id: child.id, customer });
  };

  const handleBreadcrumbClick = (crumb) => {
    onScopeChange({ level: crumb.level, id: crumb.id, customer });
  };

  const handleCustomerChange = (e) => {
    const val = e.target.value === '' ? null : e.target.value;
    onScopeChange({ ...scope, customer: val });
  };

  const handleDimensionChange = (dim) => {
    setDimension(dim);
    if (dim === 'customer') {
      // Switch to customer-first view
      onScopeChange({ level: 'all', id: 'all', customer: null });
    } else if (dim === 'product') {
      onScopeChange({ level: 'all', id: 'all', customer: null });
    }
  };

  const customerList = dimensions?.customer?.values || [];

  return (
    <div style={{
      background: T.white,
      borderBottom: `1px solid ${T.border}`,
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      {/* Dimension toggles */}
      <div style={{ display: 'flex', gap: 2, background: T.bgDark, borderRadius: 6, padding: 2 }}>
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleDimensionChange(key)}
            style={{
              background: dimension === key ? T.white : 'transparent',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: dimension === key ? 500 : 400,
              color: dimension === key ? T.ink : T.inkLight,
              cursor: 'pointer',
              fontFamily: T.fontBody,
              boxShadow: dimension === key ? T.shadow1 : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: T.border }} />

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <button
          onClick={() => onScopeChange({ level: 'all', id: 'all', customer })}
          style={{
            ...crumbStyle,
            fontWeight: level === 'all' ? 600 : 400,
            color: level === 'all' ? T.ink : T.inkLight,
          }}
        >
          All Products
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: T.inkGhost, fontSize: 10 }}>›</span>
            <button
              onClick={() => handleBreadcrumbClick(crumb)}
              style={{
                ...crumbStyle,
                fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                color: i === breadcrumb.length - 1 ? T.ink : T.inkLight,
              }}
            >
              {crumb.name}
            </button>
          </span>
        ))}

        {/* Children dropdown (drill-down) */}
        {children.length > 0 && (
          <>
            <span style={{ color: T.inkGhost, fontSize: 10 }}>›</span>
            <select
              value=""
              onChange={(e) => {
                const child = children.find(c => c.id === e.target.value);
                if (child) handleDrillDown(child);
              }}
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 12,
                fontFamily: T.fontBody,
                color: T.inkMid,
                cursor: 'pointer',
              }}
            >
              <option value="">
                {children[0]?.level === 'brand' ? 'Select brand...' :
                 children[0]?.level === 'family' ? 'Select family...' :
                 children[0]?.level === 'line' ? 'Select line...' :
                 children[0]?.level === 'product' ? 'Select product...' :
                 children[0]?.level === 'sku' ? 'Select SKU...' : 'Select...'}
              </option>
              {children.map(child => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Customer filter */}
      {(dimension === 'product-customer' || dimension === 'customer') && (
        <>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: T.inkLight, fontFamily: T.fontBody }}>Customer:</span>
            <select
              value={customer || ''}
              onChange={handleCustomerChange}
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 12,
                fontFamily: T.fontBody,
                color: T.inkMid,
              }}
            >
              <option value="">All Customers</option>
              {customerList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Level badge */}
      <div style={{
        background: T.bgDark,
        borderRadius: 4,
        padding: '3px 8px',
        fontSize: 10,
        fontFamily: T.fontMono,
        color: T.inkLight,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {level}
      </div>
    </div>
  );
}

const crumbStyle = {
  background: 'none',
  border: 'none',
  padding: '2px 4px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Inter',
  borderRadius: 3,
};
