import { useState } from 'react';
import { T } from '../../styles/tokens';
import Card from '../shared/Card';

/* ─── Family short names for matrix ────────────────────────────────────────── */
const FAMILIES = [
  { id: 'ORI-DOG-DRY', short: 'Ori Dog Dry' },
  { id: 'ORI-CAT-DRY', short: 'Ori Cat Dry' },
  { id: 'ORI-FD',      short: 'Ori FD' },
  { id: 'ORI-TREAT',   short: 'Ori Treat' },
  { id: 'ACA-DOG-DRY', short: 'Aca Dog Dry' },
  { id: 'ACA-CAT-DRY', short: 'Aca Cat Dry' },
];

/* ─── Sequencing rules ─────────────────────────────────────────────────────── */
const RULES = [
  { id: 'EDD',        name: 'Earliest Due Date',  desc: 'Minimize late orders' },
  { id: 'SPT',        name: 'Shortest Processing Time', desc: 'Minimize average wait' },
  { id: 'CR',         name: 'Critical Ratio',      desc: 'Balance urgency and duration' },
  { id: 'CHANGEOVER', name: 'Min Changeover',      desc: 'Minimize setup time between runs' },
];

/* ─── Downtime type options ────────────────────────────────────────────────── */
const DT_TYPES = ['CIP', 'Maintenance', 'Breakdown'];

/* ─── Helper: color for changeover hours ───────────────────────────────────── */
function changeoverCellColor(hours) {
  if (hours === 0) return T.white;
  if (hours <= 0.5) return '#FEF9E7';
  if (hours <= 1.0) return '#FEF3C7';
  return '#FDE68A';
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function SetupTab({
  schedule, plant,
  onGenerate, onUpdateChangeover, onUpdateConfig, onAddDowntime, onRemoveDowntime,
}) {
  const [activeRule, setActiveRule] = useState('EDD');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newDowntime, setNewDowntime] = useState(null);

  const changeoverMatrix = schedule?.changeoverMatrix || {};
  const downtimeEvents = schedule?.downtimeEvents || [];

  /* ── Collect work centers for downtime dropdown ─────────────────────── */
  const workCenterOptions = [];
  (schedule?.stages || []).forEach(stage => {
    (stage.workCenters || []).forEach(wc => {
      workCenterOptions.push({ code: wc.code, name: wc.name });
    });
  });

  /* ── Changeover cell lookup ─────────────────────────────────────────── */
  function getChangeover(fromId, toId) {
    if (fromId === toId) return 0;
    const key = `${fromId}|${toId}`;
    if (changeoverMatrix[key] != null) return changeoverMatrix[key];
    return 0.5; // default
  }

  function handleCellClick(fromId, toId) {
    if (fromId === toId) return;
    const key = `${fromId}|${toId}`;
    setEditingCell(key);
    setEditValue(String(getChangeover(fromId, toId)));
  }

  function handleCellSave(fromId, toId) {
    const hours = parseFloat(editValue);
    if (!isNaN(hours) && hours >= 0) {
      if (onUpdateChangeover) onUpdateChangeover(fromId, toId, hours);
    }
    setEditingCell(null);
    setEditValue('');
  }

  function handleResetMatrix() {
    FAMILIES.forEach(from => {
      FAMILIES.forEach(to => {
        if (from.id !== to.id && onUpdateChangeover) {
          onUpdateChangeover(from.id, to.id, 0.5);
        }
      });
    });
  }

  function handleRuleSelect(ruleId) {
    setActiveRule(ruleId);
    if (onUpdateConfig) onUpdateConfig(ruleId);
  }

  function handleAddDowntimeRow() {
    setNewDowntime({
      workCenter: workCenterOptions[0]?.code || '',
      type: 'CIP',
      startHr: '',
      endHr: '',
      reason: '',
    });
  }

  function handleSaveDowntime() {
    if (!newDowntime) return;
    const start = parseFloat(newDowntime.startHr);
    const end = parseFloat(newDowntime.endHr);
    if (isNaN(start) || isNaN(end) || end <= start) return;
    if (onAddDowntime) {
      onAddDowntime({
        workCenter: newDowntime.workCenter,
        type: newDowntime.type,
        startTime: start,
        endTime: end,
        reason: newDowntime.reason || newDowntime.type,
      });
    }
    setNewDowntime(null);
  }

  /* ─── Styles ─────────────────────────────────────────────────────────── */
  const sectionStyle = { marginBottom: T.sp8 };
  const sectionTitle = {
    fontFamily: T.fontHeading, fontSize: 14, fontWeight: 700, color: T.ink,
    marginBottom: T.sp3, textTransform: 'uppercase', letterSpacing: 0.5,
  };
  const inputStyle = {
    fontFamily: T.fontMono, fontSize: 12, padding: '6px 10px',
    border: `1px solid ${T.border}`, borderRadius: T.r2,
    background: T.white, color: T.ink, outline: 'none',
  };
  const btnSmall = {
    fontFamily: T.fontMono, fontSize: 11, fontWeight: 500,
    padding: '6px 14px', borderRadius: T.r2, cursor: 'pointer',
    border: `1px solid ${T.border}`, background: T.white, color: T.ink,
    transition: 'all 0.12s',
  };

  return (
    <div style={{ fontFamily: T.fontBody, padding: T.sp4, maxWidth: 960, margin: '0 auto' }}>

      {/* ── Section A: Generate Schedule ──────────────────────────────── */}
      <div style={sectionStyle}>
        <Card>
          <div style={{ padding: T.sp6, textAlign: 'center' }}>
            <button
              onClick={onGenerate}
              style={{
                background: T.purple, color: T.white, border: 'none',
                borderRadius: T.r3, padding: '16px 40px',
                fontFamily: T.fontHeading, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', boxShadow: T.shadow2,
                transition: 'transform 0.1s',
                minWidth: 320,
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Generate Schedule from Firmed Plan
            </button>
            <div style={{
              fontFamily: T.fontMono, fontSize: 11, color: T.inkLight,
              marginTop: T.sp3,
            }}>
              {schedule?.lastGenerated
                ? `Last generated: ${schedule.lastGenerated}`
                : 'No schedule generated'}
            </div>
            <div style={{
              fontFamily: T.fontBody, fontSize: 12, color: T.inkGhost,
              marginTop: T.sp2, maxWidth: 400, margin: `${T.sp2}px auto 0`,
            }}>
              Schedule is generated from firmed periods in the Production Plan module
            </div>
          </div>
        </Card>
      </div>

      {/* ── Section B: Changeover Matrix ─────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: T.sp3 }}>
          <div style={sectionTitle}>Changeover Matrix</div>
          <button onClick={handleResetMatrix} style={btnSmall}>Reset to Defaults</button>
        </div>
        <Card>
          <div style={{ padding: T.sp4, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.fontMono, fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '8px 6px', textAlign: 'left', fontSize: 9,
                    color: T.inkLight, fontWeight: 500, borderBottom: `2px solid ${T.border}`,
                    textTransform: 'uppercase', letterSpacing: 1,
                  }}>
                    From \ To
                  </th>
                  {FAMILIES.map(fam => (
                    <th key={fam.id} style={{
                      padding: '8px 6px', textAlign: 'center', fontSize: 9,
                      color: T.inkLight, fontWeight: 500, borderBottom: `2px solid ${T.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {fam.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FAMILIES.map(from => (
                  <tr key={from.id}>
                    <td style={{
                      padding: '8px 6px', fontWeight: 600, color: T.inkMid,
                      borderBottom: `1px solid ${T.border}`, fontSize: 10,
                      whiteSpace: 'nowrap',
                    }}>
                      {from.short}
                    </td>
                    {FAMILIES.map(to => {
                      const hours = getChangeover(from.id, to.id);
                      const cellKey = `${from.id}|${to.id}`;
                      const isEditing = editingCell === cellKey;
                      const isDiag = from.id === to.id;
                      return (
                        <td key={to.id} style={{
                          padding: '4px 6px', textAlign: 'center',
                          borderBottom: `1px solid ${T.border}`,
                          background: isDiag ? T.bgDark : changeoverCellColor(hours),
                          cursor: isDiag ? 'default' : 'pointer',
                          minWidth: 60,
                        }}
                          onClick={() => handleCellClick(from.id, to.id)}
                        >
                          {isDiag ? (
                            <span style={{ color: T.inkGhost }}>-</span>
                          ) : isEditing ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => handleCellSave(from.id, to.id)}
                              onKeyDown={e => { if (e.key === 'Enter') handleCellSave(from.id, to.id); if (e.key === 'Escape') setEditingCell(null); }}
                              style={{
                                ...inputStyle, width: 48, textAlign: 'center',
                                padding: '2px 4px', fontSize: 11,
                              }}
                            />
                          ) : (
                            <span style={{ fontWeight: 500, color: T.ink }}>{hours}h</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── Section C: Sequencing Rule ───────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Sequencing Rule</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: T.sp3 }}>
          {RULES.map(rule => {
            const isActive = activeRule === rule.id;
            return (
              <button
                key={rule.id}
                onClick={() => handleRuleSelect(rule.id)}
                style={{
                  background: isActive ? T.ink : T.white,
                  color: isActive ? T.white : T.ink,
                  border: `1px solid ${isActive ? T.ink : T.border}`,
                  borderRadius: T.r4,
                  padding: `${T.sp4}px ${T.sp5}px`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  boxShadow: isActive ? T.shadow2 : 'none',
                }}
              >
                <div style={{
                  fontFamily: T.fontHeading, fontSize: 14, fontWeight: 700,
                  marginBottom: T.sp1,
                }}>
                  {rule.id}
                </div>
                <div style={{
                  fontFamily: T.fontBody, fontSize: 12, fontWeight: 500,
                  marginBottom: T.sp1,
                }}>
                  {rule.name}
                </div>
                <div style={{
                  fontFamily: T.fontBody, fontSize: 11,
                  color: isActive ? 'rgba(255,255,255,0.7)' : T.inkLight,
                }}>
                  {rule.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section D: Downtime Events ───────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: T.sp3 }}>
          <div style={sectionTitle}>Downtime Events</div>
          <button onClick={handleAddDowntimeRow} style={{
            ...btnSmall,
            background: T.purple, color: T.white, border: 'none',
          }}>
            Add Downtime
          </button>
        </div>
        <Card>
          <div style={{ padding: T.sp4, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.fontMono, fontSize: 11 }}>
              <thead>
                <tr>
                  {['Work Center', 'Type', 'Start (hr)', 'End (hr)', 'Reason', ''].map(h => (
                    <th key={h} style={{
                      padding: '8px 10px', textAlign: 'left',
                      fontSize: 9, color: T.inkLight, fontWeight: 500,
                      borderBottom: `2px solid ${T.border}`,
                      textTransform: 'uppercase', letterSpacing: 1,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {downtimeEvents.map((evt, idx) => (
                  <tr key={evt.id || idx} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '8px 10px', color: T.ink }}>{evt.workCenterName || evt.workCenter}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: evt.type === 'CIP' ? '#EBF2EE' : evt.type === 'Maintenance' ? T.warnBg : T.riskBg,
                        color: evt.type === 'CIP' ? T.safe : evt.type === 'Maintenance' ? T.warn : T.risk,
                      }}>
                        {evt.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>{evt.startTime}h</td>
                    <td style={{ padding: '8px 10px' }}>{evt.endTime}h</td>
                    <td style={{ padding: '8px 10px', color: T.inkMid }}>{evt.reason}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => onRemoveDowntime && onRemoveDowntime(evt.id || idx)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: T.risk, fontSize: 16, fontWeight: 700,
                          padding: '4px 8px', borderRadius: T.r1,
                          lineHeight: 1,
                        }}
                        title="Remove downtime event"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                ))}

                {/* New row being added */}
                {newDowntime && (
                  <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.bgDark }}>
                    <td style={{ padding: '6px 10px' }}>
                      <select
                        value={newDowntime.workCenter}
                        onChange={e => setNewDowntime(prev => ({ ...prev, workCenter: e.target.value }))}
                        style={{ ...inputStyle, width: '100%' }}
                      >
                        {workCenterOptions.map(wc => (
                          <option key={wc.code} value={wc.code}>{wc.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <select
                        value={newDowntime.type}
                        onChange={e => setNewDowntime(prev => ({ ...prev, type: e.target.value }))}
                        style={{ ...inputStyle, width: '100%' }}
                      >
                        {DT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="number" placeholder="0"
                        value={newDowntime.startHr}
                        onChange={e => setNewDowntime(prev => ({ ...prev, startHr: e.target.value }))}
                        style={{ ...inputStyle, width: 60 }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="number" placeholder="8"
                        value={newDowntime.endHr}
                        onChange={e => setNewDowntime(prev => ({ ...prev, endHr: e.target.value }))}
                        style={{ ...inputStyle, width: 60 }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="text" placeholder="Reason"
                        value={newDowntime.reason}
                        onChange={e => setNewDowntime(prev => ({ ...prev, reason: e.target.value }))}
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={handleSaveDowntime} style={{
                        ...btnSmall, background: T.safe, color: T.white, border: 'none',
                        padding: '4px 10px', marginRight: 4,
                      }}>
                        Save
                      </button>
                      <button onClick={() => setNewDowntime(null)} style={{
                        ...btnSmall, padding: '4px 10px',
                      }}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                )}

                {downtimeEvents.length === 0 && !newDowntime && (
                  <tr>
                    <td colSpan={6} style={{
                      padding: T.sp6, textAlign: 'center',
                      color: T.inkLight, fontFamily: T.fontBody,
                    }}>
                      No downtime events scheduled
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
