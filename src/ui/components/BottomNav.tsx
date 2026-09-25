import type { Tab } from '../controller';
import { useController } from '../hooks';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'store', icon: '🏪', label: 'Magasin' },
  { id: 'stock', icon: '📦', label: 'Stock' },
  { id: 'computer', icon: '💻', label: 'Ordinateur' },
  { id: 'finances', icon: '📊', label: 'Finances' },
  { id: 'manage', icon: '⚙️', label: 'Gestion' },
];

export function BottomNav(props: { highlight?: string | null }) {
  const c = useController();
  const s = c.engine.state;
  const alerts: Partial<Record<Tab, number>> = {
    computer: s.orders.filter((o) => o.status === 'arrived').length,
    manage: s.objectives.filter((o) => !o.done).length ? 0 : 0,
  };
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`nav-btn ${c.tab === t.id ? 'active' : ''} ${props.highlight === 'nav-' + t.id ? 'pulse' : ''}`}
          onClick={() => c.setTab(t.id)}
          data-testid={`nav-${t.id}`}
        >
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
          {!!alerts[t.id] && <span className="nav-dot">{alerts[t.id]}</span>}
        </button>
      ))}
    </nav>
  );
}
