interface CPriorityExplanationProps {
  onShowCPriority: () => void;
}

export default function CPriorityExplanation({ onShowCPriority }: CPriorityExplanationProps) {
  return (
    <section className="c-priority-section" aria-labelledby="c-priority-title">
      <div className="c-priority-card">
        <div className="c-priority-icon" aria-hidden="true">
          C
        </div>
        <div className="c-priority-content">
          <h3 id="c-priority-title">Почему C имеет приоритет?</h3>
          <p>
            Если товар одновременно негабаритный и имеет круг в сечении, он направляется в C.
            Сначала проверяются габариты, и только если они проходят — форма.
            Это предотвращает попадание негабаритных объектов в основной сортировщик.
          </p>
          <button type="button" className="btn-primary" onClick={onShowCPriority}>
            Показать C-priority
          </button>
        </div>
      </div>
    </section>
  );
}
