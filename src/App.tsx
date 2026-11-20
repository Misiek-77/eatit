import { Suspense } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { NUTRITION_ROUTES } from './nutrition/routes';
import { useNutrition } from './nutrition/state/nutritionContext';
import { Icon, type IconName } from './shared/Icon';
import { UpdateBanner } from './shared/UpdateBanner';

/** The standalone app's tabs. A merged app would show a single "Dieta" tab instead. */
const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/dieta', label: 'Dziennik', icon: 'today', end: true },
  { to: '/dieta/produkty', label: 'Produkty', icon: 'products' },
  { to: '/dieta/ustawienia', label: 'Cele', icon: 'settings' },
];

export function App() {
  const { error, dismissError } = useNutrition();
  return (
    <HashRouter>
      <div className="app">
        {error && (
          <div className="banner" role="alert">
            <span style={{ flex: 1 }}>{error}</span>
            <button type="button" className="icon-btn" aria-label="Zamknij komunikat" onClick={dismissError}>
              <Icon name="close" />
            </button>
          </div>
        )}
        <UpdateBanner />
        <Suspense fallback={<main className="screen" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dieta" replace />} />
            {NUTRITION_ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            <Route path="*" element={<Navigate to="/dieta" replace />} />
          </Routes>
        </Suspense>
        <div className="tabbar">
          <nav aria-label="Główna nawigacja">
            {TABS.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
                <Icon name={tab.icon} />
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </HashRouter>
  );
}
