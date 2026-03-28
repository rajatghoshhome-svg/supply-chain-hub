import { useState } from 'react';
import { T } from '../../styles/tokens';

export default function DataTable({ columns, data, onRowClick }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sorted = sortCol
    ? [...data].sort((a, b) => {
        const va = a[sortCol], vb = b[sortCol];
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => col.sortable !== false && handleSort(col.key)}
                style={{ padding: '10px 14px', textAlign: col.align || 'left', fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', borderBottom: `1px solid ${T.border}`, cursor: col.sortable !== false ? 'pointer' : 'default', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = T.bgDark}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, color: T.ink, textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: T.inkLight, fontSize: 13 }}>No data available</div>
      )}
    </div>
  );
}
