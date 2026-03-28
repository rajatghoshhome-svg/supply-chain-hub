import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';

const CARD = {
  background: T.white,
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  padding: '20px 24px',
};

const LABEL = {
  fontFamily: 'JetBrains Mono',
  fontSize: 9.5,
  color: T.inkLight,
  letterSpacing: 1.3,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const VALUE = {
  fontFamily: 'JetBrains Mono',
  fontWeight: 600,
  fontSize: 22,
  color: T.ink,
  letterSpacing: -0.3,
};

const SMALL_VALUE = {
  fontFamily: 'JetBrains Mono',
  fontSize: 13,
  color: T.ink,
};

const CARD_TITLE = {
  fontFamily: 'Sora',
  fontWeight: 600,
  fontSize: 14,
  color: T.ink,
  marginBottom: 14,
};

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function SeverityDot({ severity }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: severity === 'critical' ? T.risk : T.warn,
      marginRight: 8,
      flexShrink: 0,
    }} />
  );
}

function AttentionList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      ...CARD,
      marginBottom: 16,
      borderColor: items.some(i => i.severity === 'critical') ? T.riskBorder : T.warnBorder,
      background: items.some(i => i.severity === 'critical') ? T.riskBg : T.warnBg,
    }}>
      <div style={{ ...LABEL, marginBottom: 10, color: items.some(i => i.severity === 'critical') ? T.risk : T.warn }}>
        Attention Items
      </div>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '6px 0',
          borderTop: i > 0 ? `1px solid ${items.some(it => it.severity === 'critical') ? T.riskBorder : T.warnBorder}` : 'none',
        }}>
          <SeverityDot severity={item.severity} />
          <div style={{ flex: 1 }}>
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: 10,
              fontWeight: 600,
              color: item.severity === 'critical' ? T.risk : T.warn,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginRight: 8,
            }}>
              {item.module}
            </span>
            <span style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.5 }}>
              {item.message}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SnapshotCard({ title, children }) {
  return (
    <div style={CARD}>
      <div style={CARD_TITLE}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={LABEL}>{label}</div>
      <div style={{ ...VALUE, color: color || T.ink }}>{value}</div>
    </div>
  );
}

function SmallStat({ label, value, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ ...LABEL, fontSize: 9, marginBottom: 3 }}>{label}</div>
      <div style={{ ...SMALL_VALUE, color: color || T.ink }}>{value}</div>
    </div>
  );
}

export default function MorningBriefing() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/briefing/summary')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
        <div style={{ ...LABEL, marginBottom: 8 }}>Loading Morning Briefing</div>
        <div style={{ fontSize: 12, color: T.inkLight }}>Running all 5 planning engines...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...CARD, borderColor: T.riskBorder, background: T.riskBg, padding: 24 }}>
        <div style={{ ...CARD_TITLE, color: T.risk }}>Briefing Unavailable</div>
        <div style={{ fontSize: 12, color: T.inkMid }}>{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { networkHealth, demandSnapshot, drpSnapshot, productionSnapshot, schedulingSnapshot, mrpSnapshot, attentionItems } = data;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={LABEL}>Daily Intelligence</div>
          <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 18, color: T.ink, letterSpacing: -0.3 }}>
            Morning Briefing
          </div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight }}>
          {formatDate()}
        </div>
      </div>

      {/* Attention Items */}
      <AttentionList items={attentionItems} />

      {/* 2x3 Grid of Module Snapshots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* Demand */}
        <SnapshotCard title="Demand Plan">
          <Stat label="Total 8-Week Forecast" value={demandSnapshot.totalForecast.toLocaleString()} />
          <SmallStat label="Top SKU" value={demandSnapshot.topSku} />
          <SmallStat
            label="Avg MAPE"
            value={`${demandSnapshot.avgMape}%`}
            color={demandSnapshot.avgMape > 25 ? T.warn : T.safe}
          />
        </SnapshotCard>

        {/* DRP */}
        <SnapshotCard title="Distribution Planning">
          <Stat label="SKUs Planned" value={drpSnapshot.skusPlanned} />
          <SmallStat
            label="Exceptions"
            value={drpSnapshot.exceptions}
            color={drpSnapshot.exceptions > 0 ? T.warn : T.safe}
          />
          <SmallStat
            label="Critical"
            value={drpSnapshot.critical}
            color={drpSnapshot.critical > 0 ? T.risk : T.safe}
          />
        </SnapshotCard>

        {/* Production */}
        <SnapshotCard title="Production Plan">
          <Stat label="Plants Active" value={productionSnapshot.plantsActive} />
          {Object.entries(productionSnapshot.recommendedStrategies).map(([plant, strategy]) => (
            <SmallStat
              key={plant}
              label={plant.replace('PLANT-', '')}
              value={strategy}
            />
          ))}
        </SnapshotCard>

        {/* Scheduling */}
        <SnapshotCard title="Scheduling">
          <Stat label="Total Orders" value={schedulingSnapshot.totalOrders} />
          <SmallStat label="Avg Makespan" value={`${schedulingSnapshot.avgMakespan}h`} />
          <SmallStat
            label="Late Orders"
            value={schedulingSnapshot.totalLateOrders}
            color={schedulingSnapshot.totalLateOrders > 0 ? T.risk : T.safe}
          />
        </SnapshotCard>

        {/* MRP */}
        <SnapshotCard title="Material Requirements">
          <Stat
            label="Total Exceptions"
            value={mrpSnapshot.totalExceptions}
            color={mrpSnapshot.totalExceptions > 10 ? T.warn : T.ink}
          />
          <SmallStat
            label="Critical"
            value={mrpSnapshot.critical}
            color={mrpSnapshot.critical > 0 ? T.risk : T.safe}
          />
          {mrpSnapshot.topShortages.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ ...LABEL, fontSize: 9, marginBottom: 4 }}>Top Shortages</div>
              {mrpSnapshot.topShortages.slice(0, 3).map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: T.risk, fontFamily: 'JetBrains Mono', marginBottom: 2 }}>
                  {s.sku} @ {s.plant.replace('PLANT-', '')}
                </div>
              ))}
            </div>
          )}
        </SnapshotCard>

        {/* Network */}
        <SnapshotCard title="Network Health">
          <Stat label="Active Lanes" value={networkHealth.lanes} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <SmallStat label="Suppliers" value={networkHealth.suppliers} />
            <SmallStat label="Plants" value={networkHealth.plants} />
            <SmallStat label="DCs" value={networkHealth.dcs} />
            <SmallStat label="Products" value={networkHealth.products} />
          </div>
        </SnapshotCard>

      </div>
    </div>
  );
}
