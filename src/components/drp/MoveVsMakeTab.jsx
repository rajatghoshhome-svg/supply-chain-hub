import { useState } from 'react';
import { T } from '../../styles/tokens';
import Card from '../shared/Card';

const API = '/api/drp';

export default function MoveVsMakeTab({ scenarios, onRefresh }) {
  const [expandedId, setExpandedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!scenarios) return <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>;

  const open = scenarios.filter(s => s.status === 'open');
  const executed = scenarios.filter(s => s.status === 'executed');

  const handleExecute = async (scenarioId, decision) => {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`${API}/move-vs-make/${scenarioId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await resp.json();
      if (data.error) setError(data.error);
      else if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const CostBar = ({ moveCost, makeCost }) => {
    const max = Math.max(moveCost, makeCost, 1);
    return (
      <div style={{ marginTop: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: T.inkMid, width: 40 }}>Move</span>
          <div style={{ flex: 1, height: 16, background: T.bgDark, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', width: `${(moveCost / max) * 100}%`,
              background: moveCost <= makeCost ? T.safe : T.warn,
              borderRadius: 3, transition: 'width 0.3s',
            }} />
            <span style={{
              position: 'absolute', right: 4, top: 1, fontSize: 10, fontFamily: T.fontMono,
              color: T.ink, fontWeight: 600,
            }}>
              ${moveCost.toLocaleString()}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: T.inkMid, width: 40 }}>Make</span>
          <div style={{ flex: 1, height: 16, background: T.bgDark, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', width: `${(makeCost / max) * 100}%`,
              background: makeCost <= moveCost ? T.safe : T.warn,
              borderRadius: 3, transition: 'width 0.3s',
            }} />
            <span style={{
              position: 'absolute', right: 4, top: 1, fontSize: 10, fontFamily: T.fontMono,
              color: T.ink, fontWeight: 600,
            }}>
              ${makeCost.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const ScenarioDetail = ({ scenario }) => {
    const { analysis } = scenario;
    if (!analysis) return null;
    const { moveOption, makeOption, recommendation, savingsPercent, savingsAmount } = analysis;

    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Move option */}
          <div style={{
            border: `2px solid ${recommendation === 'move' ? T.safe : T.border}`,
            borderRadius: 8, padding: 14, background: recommendation === 'move' ? T.safeBg : T.white,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>MOVE</span>
              {recommendation === 'move' && (
                <span style={{
                  background: T.safe, color: T.white, padding: '2px 8px', borderRadius: 4,
                  fontSize: 10, fontWeight: 600, fontFamily: T.fontMono,
                }}>
                  RECOMMENDED
                </span>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.fontMono, color: T.ink, marginBottom: 8 }}>
              ${moveOption.cost.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: T.inkMid, marginBottom: 8 }}>
              {moveOption.leadTimeDays} days lead time
            </div>
            {/* Steps */}
            {moveOption.steps?.map((step, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 11,
                padding: '4px 0', borderBottom: i < moveOption.steps.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <span style={{ color: T.inkMid }}>{step.label}</span>
                <span style={{ fontFamily: T.fontMono, color: T.ink }}>
                  {step.cost > 0 ? `$${step.cost.toLocaleString()}` : '—'} · {step.days}d
                </span>
              </div>
            ))}
            {/* Risk factors */}
            <div style={{ marginTop: 8 }}>
              {moveOption.riskFactors?.map((rf, i) => (
                <div key={i} style={{ fontSize: 10, color: T.warn, marginTop: 2 }}>⚠ {rf}</div>
              ))}
            </div>
          </div>

          {/* Make option */}
          <div style={{
            border: `2px solid ${recommendation === 'make' ? T.safe : T.border}`,
            borderRadius: 8, padding: 14, background: recommendation === 'make' ? T.safeBg : T.white,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>MAKE</span>
              {recommendation === 'make' && (
                <span style={{
                  background: T.safe, color: T.white, padding: '2px 8px', borderRadius: 4,
                  fontSize: 10, fontWeight: 600, fontFamily: T.fontMono,
                }}>
                  RECOMMENDED
                </span>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: T.fontMono, color: T.ink, marginBottom: 8 }}>
              ${makeOption.cost.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: T.inkMid, marginBottom: 8 }}>
              {makeOption.leadTimeDays} days lead time
            </div>
            {makeOption.steps?.map((step, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 11,
                padding: '4px 0', borderBottom: i < makeOption.steps.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <span style={{ color: T.inkMid }}>{step.label}</span>
                <span style={{ fontFamily: T.fontMono, color: T.ink }}>
                  {step.cost > 0 ? `$${step.cost.toLocaleString()}` : '—'} · {step.days}d
                </span>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              {makeOption.riskFactors?.map((rf, i) => (
                <div key={i} style={{ fontSize: 10, color: T.warn, marginTop: 2 }}>⚠ {rf}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost comparison bar */}
        <CostBar moveCost={moveOption.cost} makeCost={makeOption.cost} />

        {/* Savings badge */}
        <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 12 }}>
          <span style={{
            background: T.safeBg, color: T.safe, padding: '4px 12px', borderRadius: 6,
            fontSize: 12, fontWeight: 600, fontFamily: T.fontMono,
          }}>
            {recommendation === 'move' ? 'Move' : 'Make'} saves ${savingsAmount?.toLocaleString()} ({savingsPercent}%)
          </span>
        </div>

        {/* Action buttons */}
        {scenario.status === 'open' && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => handleExecute(scenario.id, 'move')}
              disabled={busy}
              style={{
                background: recommendation === 'move' ? T.safe : T.white,
                color: recommendation === 'move' ? T.white : T.ink,
                border: `1.5px solid ${recommendation === 'move' ? T.safe : T.border}`,
                borderRadius: 6, padding: '8px 24px', fontSize: 12, fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              Execute Move
            </button>
            <button
              onClick={() => handleExecute(scenario.id, 'make')}
              disabled={busy}
              style={{
                background: recommendation === 'make' ? T.safe : T.white,
                color: recommendation === 'make' ? T.white : T.ink,
                border: `1.5px solid ${recommendation === 'make' ? T.safe : T.border}`,
                borderRadius: 6, padding: '8px 24px', fontSize: 12, fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              Execute Make
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 40px' }}>
      {error && (
        <div style={{
          background: T.riskBg, border: `1px solid ${T.riskBorder}`, borderRadius: 6,
          padding: '8px 14px', marginBottom: 12, fontSize: 12, color: T.risk,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{
            float: 'right', background: 'none', border: 'none', color: T.risk,
            cursor: 'pointer', fontSize: 12,
          }}>✕</button>
        </div>
      )}

      {/* Open scenarios */}
      <Card title={`Inventory Imbalance Scenarios (${open.length} open)`}>
        {open.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: T.inkLight, fontSize: 13 }}>
            All scenarios have been resolved
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 70px 70px',
              gap: 8, padding: '8px 12px', borderBottom: `2px solid ${T.border}`,
              fontSize: 10, color: T.inkMid, fontWeight: 600, fontFamily: T.fontMono,
              textTransform: 'uppercase',
            }}>
              <span>SKU</span>
              <span>Source DC</span>
              <span>Dest DC</span>
              <span style={{ textAlign: 'right' }}>Source DOH</span>
              <span style={{ textAlign: 'right' }}>Dest DOH</span>
              <span style={{ textAlign: 'right' }}>Gap (units)</span>
              <span style={{ textAlign: 'center' }}>Severity</span>
            </div>

            {open.map(scenario => (
              <div key={scenario.id}>
                <div
                  onClick={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 70px 70px',
                    gap: 8, padding: '10px 12px', borderBottom: `1px solid ${T.border}`,
                    cursor: 'pointer', transition: 'background 0.1s',
                    background: expandedId === scenario.id ? T.bgDark : 'transparent',
                  }}
                  onMouseEnter={e => { if (expandedId !== scenario.id) e.currentTarget.style.background = T.bg; }}
                  onMouseLeave={e => { if (expandedId !== scenario.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.ink }}>
                    {expandedId === scenario.id ? '▾' : '▸'} {scenario.skuName}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: T.fontMono, color: T.inkMid }}>{scenario.fromDCName || scenario.fromDC}</span>
                  <span style={{ fontSize: 11, fontFamily: T.fontMono, color: T.inkMid }}>{scenario.toDCName || scenario.toDC}</span>
                  <span style={{ fontSize: 11, fontFamily: T.fontMono, textAlign: 'right', color: T.safe }}>{scenario.fromDaysOfSupply}d</span>
                  <span style={{ fontSize: 11, fontFamily: T.fontMono, textAlign: 'right', color: scenario.toDaysOfSupply < 7 ? T.risk : T.warn }}>{scenario.toDaysOfSupply}d</span>
                  <span style={{ fontSize: 11, fontFamily: T.fontMono, textAlign: 'right' }}>{scenario.qty}</span>
                  <span style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10, fontFamily: T.fontMono, fontWeight: 600,
                      color: scenario.severity === 'critical' ? T.risk : T.warn,
                      background: scenario.severity === 'critical' ? T.riskBg : T.warnBg,
                      padding: '1px 6px', borderRadius: 3,
                    }}>
                      {scenario.severity}
                    </span>
                  </span>
                </div>

                {expandedId === scenario.id && (
                  <div style={{ padding: '8px 12px 16px', background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                    <ScenarioDetail scenario={scenario} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Decision log */}
      {executed.length > 0 && (
        <Card title={`Decision Log (${executed.length})`} style={{ marginTop: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: T.fontBody }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>Route</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>Decision</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>Executed</th>
                </tr>
              </thead>
              <tbody>
                {executed.map(s => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '6px 10px' }}>{s.skuName}</td>
                    <td style={{ padding: '6px 10px', fontFamily: T.fontMono, fontSize: 10 }}>{s.fromDC} → {s.toDC}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <span style={{
                        fontFamily: T.fontMono, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 3,
                        background: s.executedDecision === 'move' ? T.safeBg : T.warnBg,
                        color: s.executedDecision === 'move' ? T.safe : T.warn,
                        textTransform: 'uppercase',
                      }}>
                        {s.executedDecision}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: T.fontMono }}>{s.qty}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 10, color: T.inkLight, fontFamily: T.fontMono }}>
                      {s.executedAt ? new Date(s.executedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
