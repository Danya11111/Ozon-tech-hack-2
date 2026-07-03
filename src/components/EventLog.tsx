import type { EventLogEntry } from '../domain/types';

function formatTime(ms: number): string {
  return `t+${(ms / 1000).toFixed(1)}s`;
}

export default function EventLog({ events }: { events: EventLogEntry[] }) {
  return (
    <section className="panel event-panel">
      <div className="panel-heading">
        <p className="eyebrow">Event log</p>
        <h2>Cycle trace</h2>
      </div>
      <div className="event-table" role="table">
        <div className="event-row event-head" role="row">
          <span>time</span><span>item</span><span>type</span><span>message</span><span>category</span><span>status</span>
        </div>
        {events.length === 0 ? (
          <div className="empty-log">No events yet. Press Start or Step.</div>
        ) : events.map((entry) => (
          <div className={`event-row ${entry.status}`} role="row" key={entry.id}>
            <span>{formatTime(entry.timestampMs)}</span>
            <span>{entry.itemId ?? '-'}</span>
            <span>{entry.type}</span>
            <span>{entry.message}</span>
            <span>{entry.category ?? '-'}</span>
            <span>{entry.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
