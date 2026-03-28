import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../styles/tokens';

// ─── Constants ───────────────────────────────────────────────────

const STEPS = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'upload', label: 'Upload Data' },
  { key: 'review', label: 'Review' },
  { key: 'run', label: 'First Run' },
  { key: 'done', label: 'Live' },
];

const DATA_TYPES = [
  { key: 'skus', label: 'SKUs / Items', desc: 'Master list of all products and materials', requirement: 'required', icon: '#' },
  { key: 'locations', label: 'Locations / Sites', desc: 'Plants, warehouses, and distribution centers', requirement: 'required', icon: '@' },
  { key: 'bom', label: 'Bills of Material', desc: 'Parent-child relationships and quantities', requirement: 'required', icon: '{}' },
  { key: 'demand-history', label: 'Demand History', desc: 'Historical demand by SKU and period', requirement: 'required', icon: '~' },
  { key: 'inventory', label: 'Inventory Positions', desc: 'Current stock levels by location', requirement: 'recommended', icon: '[]' },
  { key: 'planning-params', label: 'Planning Parameters', desc: 'Lead times, safety stock, lot sizing rules', requirement: 'optional', icon: '%' },
];

// ─── Step Indicator ──────────────────────────────────────────────

function StepIndicator({ currentStep, completedSteps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '24px 40px 0' }}>
      {STEPS.map((step, i) => {
        const isActive = currentStep === i;
        const isCompleted = completedSteps.includes(i);
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? T.ink : isCompleted ? T.accent : T.bgDark,
                color: isActive || isCompleted ? T.white : T.inkLight,
                fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono',
                transition: 'all 0.2s',
              }}>
                {isCompleted ? '\u2713' : i + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: isActive ? 600 : 400,
                color: isActive ? T.ink : isCompleted ? T.accent : T.inkLight,
                fontFamily: 'Inter',
              }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                width: 40, height: 1, margin: '0 8px',
                background: isCompleted ? T.accent : T.border,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Welcome Step ────────────────────────────────────────────────

function WelcomeStep({ onNext }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
        Implementation Wizard
      </div>
      <h2 style={{ fontFamily: 'Sora', fontSize: 26, fontWeight: 700, color: T.ink, letterSpacing: -0.5, margin: '0 0 16px' }}>
        Upload your supply chain data to get started
      </h2>
      <p style={{ fontSize: 14, color: T.inkMid, lineHeight: 1.7, margin: '0 0 32px' }}>
        This wizard will guide you through importing your data, validating it, and running your first planning cascade. The system will auto-detect column mappings, fix common data issues, and flag anything that needs your attention.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'left', marginBottom: 36 }}>
        {[
          { title: 'Master Data', items: ['SKUs / Items', 'Locations / Sites', 'Bills of Material'], tag: 'required' },
          { title: 'Transactional Data', items: ['Demand History', 'Inventory Positions'], tag: 'required + recommended' },
          { title: 'Policy Data', items: ['Planning Parameters'], tag: 'optional' },
        ].map(group => (
          <div key={group.title} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: '20px' }}>
            <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{group.title}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>{group.tag}</div>
            {group.items.map(item => (
              <div key={item} style={{ fontSize: 12, color: T.inkMid, padding: '4px 0', borderTop: `1px solid ${T.border}` }}>{item}</div>
            ))}
          </div>
        ))}
      </div>

      <button onClick={onNext} className="bp" style={{
        background: T.ink, color: T.white, border: 'none', padding: '12px 32px', borderRadius: 8,
        cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'Sora', transition: 'opacity 0.15s',
      }}>
        Start Setup
      </button>
    </div>
  );
}

// ─── Upload Card ─────────────────────────────────────────────────

function UploadCard({ dataType, uploadState, onUpload, onAccept, onReupload, onDownloadTemplate }) {
  const [csvText, setCsvText] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const status = uploadState?.status || 'not-started';

  const handlePaste = useCallback((text) => {
    setCsvText(text);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        setCsvText(text);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setCsvText(ev.target.result);
      reader.readAsText(file);
    }
  }, []);

  const requirementColor = dataType.requirement === 'required' ? T.ink
    : dataType.requirement === 'recommended' ? T.warn : T.inkLight;

  return (
    <div style={{
      background: T.white, border: `1px solid ${status === 'ready' ? T.accent : status === 'errors' ? T.risk : T.border}`,
      borderRadius: 10, padding: '20px 24px', transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: T.accent, fontWeight: 600 }}>{dataType.icon}</span>
            <span style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>{dataType.label}</span>
          </div>
          <div style={{ fontSize: 12, color: T.inkMid, marginTop: 2 }}>{dataType.desc}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
            color: requirementColor, fontWeight: 600,
          }}>
            {dataType.requirement}
          </span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Upload area — show only if not yet uploaded */}
      {(status === 'not-started' || status === 'errors') && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `1.5px dashed ${dragOver ? T.accent : T.borderMid}`,
              borderRadius: 8, padding: '16px', marginBottom: 12,
              background: dragOver ? T.safeBg : T.bg,
              transition: 'all 0.15s',
            }}
          >
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              onPaste={(e) => handlePaste(e.clipboardData.getData('text'))}
              placeholder="Paste CSV data here, or drag and drop a .csv file..."
              style={{
                width: '100%', minHeight: 80, border: 'none', background: 'transparent', resize: 'vertical',
                fontFamily: 'JetBrains Mono', fontSize: 11, color: T.ink, outline: 'none',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <label style={{
                fontSize: 11, color: T.accent, cursor: 'pointer', fontWeight: 500,
              }}>
                <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileSelect} style={{ display: 'none' }} />
                Choose file
              </label>
              <button onClick={onDownloadTemplate} style={{
                background: 'none', border: 'none', fontSize: 11, color: T.inkLight, cursor: 'pointer',
                fontFamily: 'JetBrains Mono', textDecoration: 'underline',
              }}>
                Download template
              </button>
            </div>
          </div>

          <button
            onClick={() => onUpload(csvText)}
            disabled={!csvText.trim()}
            className="bp"
            style={{
              background: csvText.trim() ? T.ink : T.bgDark,
              color: csvText.trim() ? T.white : T.inkLight,
              border: 'none', padding: '8px 20px', borderRadius: 7, cursor: csvText.trim() ? 'pointer' : 'default',
              fontSize: 12, fontWeight: 500, fontFamily: 'Sora', transition: 'all 0.15s',
            }}
          >
            Upload & Validate
          </button>
        </>
      )}

      {/* Uploading state */}
      {status === 'uploading' && (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: T.inkLight, fontFamily: 'JetBrains Mono' }}>Validating...</div>
        </div>
      )}

      {/* Results — show when uploaded */}
      {(status === 'ready' || status === 'errors') && uploadState?.result && (
        <div style={{ marginTop: 12 }}>
          {/* Row count */}
          <div style={{ fontSize: 12, color: T.inkMid, marginBottom: 8 }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{uploadState.result.rowCount}</span> rows parsed
          </div>

          {/* Column mapping */}
          {uploadState.result.columnMapping?.suggestions && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                Column Mapping
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {uploadState.result.columnMapping.suggestions.map(m => (
                  <span key={m.targetField} style={{
                    fontSize: 10, fontFamily: 'JetBrains Mono', padding: '3px 8px', borderRadius: 4,
                    background: m.confidence >= 90 ? T.safeBg : m.confidence >= 60 ? T.warnBg : T.riskBg,
                    color: m.confidence >= 90 ? T.safe : m.confidence >= 60 ? T.warn : T.risk,
                    border: `1px solid ${m.confidence >= 90 ? '#c8dcd0' : m.confidence >= 60 ? T.warnBorder : T.riskBorder}`,
                  }}>
                    {m.sourceColumn || '?'} {'\u2192'} {m.targetField} ({m.confidence}%)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          {uploadState.result.preview?.length > 0 && (
            <div style={{ marginBottom: 12, overflow: 'auto' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                Preview (first {uploadState.result.preview.length} rows)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                <thead>
                  <tr>
                    {Object.keys(uploadState.result.preview[0]).map(col => (
                      <th key={col} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: `1px solid ${T.border}`, color: T.inkLight, fontSize: 10, fontWeight: 500 }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadState.result.preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} style={{ padding: '4px 8px', borderBottom: `1px solid ${T.border}`, color: T.inkMid, fontSize: 10 }}>
                          {String(val).substring(0, 30)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Validation results */}
          {uploadState.result.validation?.errors?.length > 0 && (
            <div style={{ background: T.riskBg, border: `1px solid ${T.riskBorder}`, borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.risk, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Errors ({uploadState.result.validation.errors.length})
              </div>
              {uploadState.result.validation.errors.slice(0, 5).map((err, i) => (
                <div key={i} style={{ fontSize: 11, color: T.risk, padding: '2px 0' }}>{err.message}</div>
              ))}
              {uploadState.result.validation.errors.length > 5 && (
                <div style={{ fontSize: 10, color: T.inkLight, marginTop: 4 }}>
                  ...and {uploadState.result.validation.errors.length - 5} more
                </div>
              )}
            </div>
          )}

          {/* Health check results */}
          {uploadState.result.healthChecks?.autoFixed?.length > 0 && (
            <div style={{ background: T.safeBg, border: `1px solid #c8dcd0`, borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.safe, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Auto-Fixed ({uploadState.result.healthChecks.autoFixed.length})
              </div>
              {uploadState.result.healthChecks.autoFixed.map((fix, i) => (
                <div key={i} style={{ fontSize: 11, color: T.safe, padding: '2px 0' }}>{fix.message}</div>
              ))}
            </div>
          )}

          {uploadState.result.healthChecks?.flagged?.length > 0 && (
            <div style={{ background: T.warnBg, border: `1px solid ${T.warnBorder}`, borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.warn, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Warnings ({uploadState.result.healthChecks.flagged.length})
              </div>
              {uploadState.result.healthChecks.flagged.map((flag, i) => (
                <div key={i} style={{ fontSize: 11, color: T.warn, padding: '2px 0' }}>{flag.message}</div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {status === 'ready' && (
              <button onClick={onAccept} className="bp" style={{
                background: T.accent, color: T.white, border: 'none', padding: '7px 16px', borderRadius: 6,
                cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'Sora',
              }}>
                Accept & Continue
              </button>
            )}
            <button onClick={() => { onReupload(); setCsvText(''); }} style={{
              background: 'none', color: T.inkLight, border: `1px solid ${T.border}`, padding: '7px 16px', borderRadius: 6,
              cursor: 'pointer', fontSize: 12, fontFamily: 'Sora',
            }}>
              Re-upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    'not-started': { label: 'Not started', bg: T.bgDark, color: T.inkLight, border: T.border },
    'uploading': { label: 'Uploading...', bg: T.warnBg, color: T.warn, border: T.warnBorder },
    'ready': { label: 'Ready', bg: T.safeBg, color: T.safe, border: '#c8dcd0' },
    'errors': { label: 'Has errors', bg: T.riskBg, color: T.risk, border: T.riskBorder },
    'accepted': { label: 'Accepted', bg: T.safeBg, color: T.accent, border: '#c8dcd0' },
  };
  const c = config[status] || config['not-started'];
  return (
    <span style={{
      fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 4, background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {c.label}
    </span>
  );
}

// ─── Upload Step ─────────────────────────────────────────────────

function UploadStep({ uploads, onUpload, onAccept, onReupload, onDownloadTemplate, onNext, onBack }) {
  const allRequiredReady = DATA_TYPES
    .filter(dt => dt.requirement === 'required')
    .every(dt => uploads[dt.key]?.status === 'accepted');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'Sora', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: -0.3, margin: 0 }}>
            Upload Your Data
          </h2>
          <p style={{ fontSize: 13, color: T.inkMid, margin: '4px 0 0' }}>
            Upload each data type below. The system will validate and auto-fix common issues.
          </p>
        </div>
        <button
          onClick={onNext}
          disabled={!allRequiredReady}
          className="bp"
          style={{
            background: allRequiredReady ? T.ink : T.bgDark,
            color: allRequiredReady ? T.white : T.inkLight,
            border: 'none', padding: '8px 20px', borderRadius: 7,
            cursor: allRequiredReady ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 500, fontFamily: 'Sora', transition: 'all 0.15s',
          }}
        >
          Continue to Review {'\u2192'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DATA_TYPES.map(dt => (
          <UploadCard
            key={dt.key}
            dataType={dt}
            uploadState={uploads[dt.key]}
            onUpload={(csv) => onUpload(dt.key, csv)}
            onAccept={() => onAccept(dt.key)}
            onReupload={() => onReupload(dt.key)}
            onDownloadTemplate={() => onDownloadTemplate(dt.key)}
          />
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: T.inkLight, cursor: 'pointer', fontSize: 12, fontFamily: 'Inter',
        }}>
          {'\u2190'} Back
        </button>
      </div>
    </div>
  );
}

// ─── Review Step ─────────────────────────────────────────────────

function ReviewStep({ uploads, onBack, onNext }) {
  const totalRows = Object.values(uploads).reduce((s, u) => s + (u?.result?.rowCount || 0), 0);
  const totalAutoFixed = Object.values(uploads).reduce(
    (s, u) => s + (u?.result?.healthChecks?.autoFixed?.length || 0), 0
  );
  const totalWarnings = Object.values(uploads).reduce(
    (s, u) => s + (u?.result?.healthChecks?.flagged?.length || 0) + (u?.result?.validation?.warnings?.length || 0), 0
  );
  const totalErrors = Object.values(uploads).reduce(
    (s, u) => s + (u?.result?.validation?.errors?.length || 0) + (u?.result?.healthChecks?.blocked?.length || 0), 0
  );

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Sora', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: -0.3, margin: '0 0 8px' }}>
        Review Your Data
      </h2>
      <p style={{ fontSize: 13, color: T.inkMid, margin: '0 0 24px' }}>
        Summary of all uploaded data before running your first plan.
      </p>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Rows', value: totalRows, color: T.ink },
          { label: 'Auto-Fixed', value: totalAutoFixed, color: T.safe },
          { label: 'Warnings', value: totalWarnings, color: T.warn },
          { label: 'Errors', value: totalErrors, color: totalErrors > 0 ? T.risk : T.safe },
        ].map(stat => (
          <div key={stat.label} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 600, color: stat.color, letterSpacing: -0.5 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Per-type detail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {DATA_TYPES.map(dt => {
          const u = uploads[dt.key];
          if (!u || u.status === 'not-started') return null;
          return (
            <div key={dt.key} style={{
              background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.accent, fontWeight: 600, width: 24 }}>{dt.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.ink, fontFamily: 'Inter' }}>{dt.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkMid }}>
                  {u.result?.rowCount || 0} rows
                </span>
                {u.result?.healthChecks?.autoFixed?.length > 0 && (
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.safe }}>
                    {u.result.healthChecks.autoFixed.length} auto-fixed
                  </span>
                )}
                <StatusBadge status={u.status} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-fixes detail */}
      {totalAutoFixed > 0 && (
        <div style={{ background: T.safeBg, border: `1px solid #c8dcd0`, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.safe, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Self-Healing Applied ({totalAutoFixed} fixes)
          </div>
          {Object.entries(uploads).map(([key, u]) => {
            if (!u?.result?.healthChecks?.autoFixed?.length) return null;
            return u.result.healthChecks.autoFixed.map((fix, i) => (
              <div key={`${key}-${i}`} style={{ fontSize: 11, color: T.safe, padding: '2px 0' }}>
                {fix.message}
              </div>
            ));
          })}
        </div>
      )}

      {/* Warnings */}
      {totalWarnings > 0 && (
        <div style={{ background: T.warnBg, border: `1px solid ${T.warnBorder}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.warn, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Warnings ({totalWarnings})
          </div>
          {Object.entries(uploads).map(([key, u]) => {
            const flagged = u?.result?.healthChecks?.flagged || [];
            const warnings = u?.result?.validation?.warnings || [];
            return [...flagged, ...warnings].map((w, i) => (
              <div key={`${key}-${i}`} style={{ fontSize: 11, color: T.warn, padding: '2px 0' }}>
                {w.message}
              </div>
            ));
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button onClick={onBack} style={{
          background: 'none', color: T.inkLight, border: `1px solid ${T.border}`, padding: '8px 20px', borderRadius: 7,
          cursor: 'pointer', fontSize: 13, fontFamily: 'Sora',
        }}>
          {'\u2190'} Fix Issues
        </button>
        <button onClick={onNext} className="bp" style={{
          background: T.ink, color: T.white, border: 'none', padding: '8px 24px', borderRadius: 7,
          cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Sora', transition: 'opacity 0.15s',
        }}>
          Looks Good {'\u2192'}
        </button>
      </div>
    </div>
  );
}

// ─── Run Step ────────────────────────────────────────────────────

function RunStep({ onRun, running, result, onNext, onBack }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'Sora', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: -0.3, margin: '0 0 8px' }}>
        Run Initial Planning Cascade
      </h2>
      <p style={{ fontSize: 13, color: T.inkMid, margin: '0 0 32px' }}>
        Run the full Demand {'\u2192'} DRP {'\u2192'} Production {'\u2192'} Scheduling {'\u2192'} MRP cascade with your uploaded data.
      </p>

      {!result && (
        <button
          onClick={onRun}
          disabled={running}
          className="bp"
          style={{
            background: running ? T.bgDark : T.accent,
            color: running ? T.inkLight : T.white,
            border: 'none', padding: '12px 32px', borderRadius: 8,
            cursor: running ? 'default' : 'pointer',
            fontSize: 14, fontWeight: 500, fontFamily: 'Sora', transition: 'all 0.15s',
          }}
        >
          {running ? 'Running Cascade...' : 'Run Initial Planning Cascade'}
        </button>
      )}

      {running && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            {['Demand', 'DRP', 'Production', 'Scheduling', 'MRP'].map((step, i) => (
              <div key={step} style={{
                padding: '8px 14px', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono',
                background: T.bgDark, color: T.inkLight,
                animation: 'pulse 1.5s infinite',
                animationDelay: `${i * 0.3}s`,
              }}>
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 24 }}>
          {result.error ? (
            <div style={{ background: T.riskBg, border: `1px solid ${T.riskBorder}`, borderRadius: 8, padding: '16px', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: T.risk }}>{result.message}</div>
            </div>
          ) : (
            <>
              <div style={{ background: T.safeBg, border: `1px solid #c8dcd0`, borderRadius: 8, padding: '16px', marginBottom: 24 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.safe, marginBottom: 4 }}>
                  Cascade Complete
                </div>
                <div style={{ fontSize: 12, color: T.inkMid }}>{result.message}</div>
                {result.planRunId && (
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, marginTop: 8 }}>
                    Plan Run ID: {result.planRunId}
                  </div>
                )}
              </div>
            </>
          )}

          <button onClick={onNext} className="bp" style={{
            background: T.ink, color: T.white, border: 'none', padding: '10px 28px', borderRadius: 7,
            cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'Sora', transition: 'opacity 0.15s',
          }}>
            Continue {'\u2192'}
          </button>
        </div>
      )}

      {!running && !result && (
        <div style={{ marginTop: 16 }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: T.inkLight, cursor: 'pointer', fontSize: 12, fontFamily: 'Inter',
          }}>
            {'\u2190'} Back to Review
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Done Step ───────────────────────────────────────────────────

function DoneStep() {
  const navigate = useNavigate();

  const modules = [
    { path: '/demand', label: 'Demand Planning', desc: 'Forecast with 5 statistical methods' },
    { path: '/drp', label: 'DRP', desc: 'Distribution requirements across your network' },
    { path: '/production-plan', label: 'Production Plan', desc: 'Chase, level, and hybrid strategies' },
    { path: '/scheduling', label: 'Scheduling', desc: 'SPT/EDD/CR sequencing with Gantt' },
    { path: '/mrp', label: 'MRP', desc: 'BOM explosion and material requirements' },
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: T.safeBg, border: `2px solid ${T.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        fontSize: 24, color: T.accent,
      }}>
        {'\u2713'}
      </div>
      <h2 style={{ fontFamily: 'Sora', fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: -0.5, margin: '0 0 8px' }}>
        Your supply chain is live!
      </h2>
      <p style={{ fontSize: 14, color: T.inkMid, margin: '0 0 32px', lineHeight: 1.6 }}>
        All data has been imported and validated. Your planning cascade has run.
        Explore each module to review results and refine your plans.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', marginBottom: 28 }}>
        {modules.map(mod => (
          <div
            key={mod.path}
            onClick={() => navigate(mod.path)}
            style={{
              background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.ink; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
          >
            <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{mod.label}</div>
            <div style={{ fontSize: 11, color: T.inkMid }}>{mod.desc}</div>
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/')} className="bp" style={{
        background: T.ink, color: T.white, border: 'none', padding: '12px 32px', borderRadius: 8,
        cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'Sora', transition: 'opacity 0.15s',
      }}>
        Go to Dashboard
      </button>
    </div>
  );
}

// ─── Main Onboarding Page ────────────────────────────────────────

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [uploads, setUploads] = useState({});
  const [cascadeRunning, setCascadeRunning] = useState(false);
  const [cascadeResult, setCascadeResult] = useState(null);

  // Fetch onboarding status on mount
  useEffect(() => {
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .then(data => {
        if (data.completed) {
          setCurrentStep(4);
          setCompletedSteps([0, 1, 2, 3]);
        }
      })
      .catch(() => {});
  }, []);

  const markCompleted = (step) => {
    setCompletedSteps(prev => prev.includes(step) ? prev : [...prev, step]);
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  // Upload handler
  const handleUpload = useCallback(async (dataType, csv) => {
    setUploads(prev => ({
      ...prev,
      [dataType]: { status: 'uploading', result: null },
    }));

    try {
      const resp = await fetch('/api/onboarding/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dataType }),
      });
      const data = await resp.json();

      setUploads(prev => ({
        ...prev,
        [dataType]: { status: data.status, result: data },
      }));
    } catch (err) {
      setUploads(prev => ({
        ...prev,
        [dataType]: { status: 'errors', result: { validation: { errors: [{ message: err.message }], warnings: [] }, healthChecks: { autoFixed: [], flagged: [], blocked: [] }, rowCount: 0, preview: [] } },
      }));
    }
  }, []);

  const handleAccept = useCallback((dataType) => {
    setUploads(prev => ({
      ...prev,
      [dataType]: { ...prev[dataType], status: 'accepted' },
    }));
  }, []);

  const handleReupload = useCallback((dataType) => {
    setUploads(prev => ({
      ...prev,
      [dataType]: { status: 'not-started', result: null },
    }));
  }, []);

  const handleDownloadTemplate = useCallback(async (dataType) => {
    try {
      const resp = await fetch('/api/onboarding/templates');
      const data = await resp.json();
      const template = data.templates[dataType];
      if (template) {
        const blob = new Blob([template.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}-template.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silently fail
    }
  }, []);

  const handleRunCascade = useCallback(async () => {
    setCascadeRunning(true);
    setCascadeResult(null);
    try {
      const resp = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (resp.ok) {
        setCascadeResult({ ok: true, ...data });
      } else {
        setCascadeResult({ ok: false, error: true, message: data.message || data.error || 'Cascade failed' });
      }
    } catch (err) {
      setCascadeResult({ ok: false, error: true, message: err.message });
    } finally {
      setCascadeRunning(false);
    }
  }, []);

  return (
    <div style={{ fontFamily: 'Inter', background: T.bg, minHeight: 'calc(100vh - 54px)' }}>
      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

      <div style={{ padding: '32px 40px 60px' }}>
        {currentStep === 0 && (
          <WelcomeStep onNext={() => { markCompleted(0); goToStep(1); }} />
        )}

        {currentStep === 1 && (
          <UploadStep
            uploads={uploads}
            onUpload={handleUpload}
            onAccept={handleAccept}
            onReupload={handleReupload}
            onDownloadTemplate={handleDownloadTemplate}
            onNext={() => { markCompleted(1); goToStep(2); }}
            onBack={() => goToStep(0)}
          />
        )}

        {currentStep === 2 && (
          <ReviewStep
            uploads={uploads}
            onBack={() => goToStep(1)}
            onNext={() => { markCompleted(2); goToStep(3); }}
          />
        )}

        {currentStep === 3 && (
          <RunStep
            onRun={handleRunCascade}
            running={cascadeRunning}
            result={cascadeResult}
            onNext={() => { markCompleted(3); goToStep(4); }}
            onBack={() => goToStep(2)}
          />
        )}

        {currentStep === 4 && (
          <DoneStep />
        )}
      </div>
    </div>
  );
}
