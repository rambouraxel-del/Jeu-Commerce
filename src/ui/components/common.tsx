import { useEffect, type ReactNode } from 'react';

export function Modal(props: {
  title?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!props.onClose) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [props.onClose]);
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className={`modal ${props.wide ? 'wide' : ''} ${props.className ?? ''}`} onClick={(e) => e.stopPropagation()} role="dialog">
        {(props.title || props.onClose) && (
          <div className="modal-head">
            <div className="modal-title">{props.title}</div>
            {props.onClose && (
              <button className="icon-btn" onClick={props.onClose} aria-label="Fermer">
                ✕
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-foot">{props.footer}</div>}
      </div>
    </div>
  );
}

export function Sheet(props: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="sheet-grip" />
        <div className="modal-head">
          <div className="modal-title">{props.title}</div>
          <button className="icon-btn" onClick={props.onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function Stepper(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; steps?: number[] }) {
  const min = props.min ?? 0;
  const max = props.max ?? 99999;
  const steps = props.steps ?? [1, 10];
  const set = (v: number) => props.onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper">
      {[...steps].reverse().map((s) => (
        <button key={'m' + s} className="step-btn" onClick={() => set(props.value - s)} disabled={props.value <= min}>
          −{s > 1 ? s : ''}
        </button>
      ))}
      <input
        className="step-val"
        inputMode="numeric"
        value={props.value}
        onChange={(e) => {
          const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
          set(Number.isFinite(v) ? v : 0);
        }}
      />
      {steps.map((s) => (
        <button key={'p' + s} className="step-btn" onClick={() => set(props.value + s)} disabled={props.value >= max}>
          +{s > 1 ? s : ''}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>(props: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`tabs ${props.className ?? ''}`} role="tablist">
      {props.options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={props.value === o.id}
          className={`tab ${props.value === o.id ? 'active' : ''}`}
          onClick={() => props.onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge(props: { tone: 'good' | 'bad' | 'warn' | 'neutral' | 'info'; children: ReactNode }) {
  return <span className={`badge ${props.tone}`}>{props.children}</span>;
}

export function Progress(props: { value: number; tone?: string }) {
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(1, props.value)) * 100}%`, background: props.tone }} />
    </div>
  );
}

export function Trend(props: { current: number; previous?: number; invert?: boolean }) {
  if (props.previous === undefined) return <span className="trend flat">→</span>;
  const diff = props.current - props.previous;
  const ref = Math.max(1, Math.abs(props.previous));
  let dir: 'up' | 'down' | 'flat' = 'flat';
  if (diff / ref > 0.03) dir = 'up';
  else if (diff / ref < -0.03) dir = 'down';
  const good = props.invert ? dir === 'down' : dir === 'up';
  const bad = props.invert ? dir === 'up' : dir === 'down';
  return <span className={`trend ${good ? 'good' : bad ? 'bad' : 'flat'}`}>{dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'}</span>;
}

export function Empty(props: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{props.icon}</div>
      <div>{props.children}</div>
    </div>
  );
}
