import { useMemo, useState } from 'react';
import type { EventLogEntry } from '../domain/types';

type LogFilter = 'all' | 'sensor' | 'classification' | 'actuator' | 'warning' | 'error' | 'success';

const filters: LogFilter[] = ['all', 'sensor', 'classification', 'actuator', 'warning', 'error', 'success'];

function formatTime(ms: number): string {
  return `t+${(ms / 1000).toFixed(1)}s`;
}

function matchesFilter(entry: EventLogEntry, filter: LogFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'error' || filter === 'success' || filter === 'warning') {
    return entry.status === filter;
  }
  return entry.type === filter;
}

export default function EventLog({ events }: { events: EventLogEntry[] }) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [copied, setCopied] = useState(false);
  const visibleEvents = useMemo(() => events.filter((entry) => matchesFilter(entry, filter)), [events, filter]);

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className="panel event-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Event log</p>
          <h2>Cycle trace</h2>
        </div>
        <button className="small-button" onClick={() => void copyJson()}>{copied ? 'Copied' : 'Copy JSON'}</button>
      </div>
      <div className="log-filters">
        {filters.map((item) => (
          <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      <div className="event-table" role="table">
        <div className="event-row event-head" role="row">
          <span>time</span><span>item</span><span>state</span><span>type</span><span>command/category</span><span>message</span><span>status</span>
        </div>
        {visibleEvents.length === 0 ? (
          <div className="empty-log">No events for this filter.</div>
        ) : visibleEvents.map((entry) => (
          <div className={`event-row ${entry.status}`} role="row" key={entry.id}>
            <span>{formatTime(entry.timestampMs)}</span>
            <span>{entry.itemId ?? '-'}</span>
            <span>{entry.state ?? '-'}</span>
            <span>{entry.type}</span>
            <span>{entry.command ?? entry.category ?? '-'}</span>
            <span>{entry.message}</span>
            <span>{entry.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
