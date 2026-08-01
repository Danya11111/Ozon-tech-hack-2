import { NavLink } from 'react-router-dom';

interface AppNavProps {
  /** Overlay (desktop sim), bar (mobile full-width), solid (docs header). */
  variant?: 'overlay' | 'bar' | 'solid';
}

/**
 * Product navigation — only Simulation and Documentation.
 */
export default function AppNav({ variant = 'solid' }: AppNavProps) {
  return (
    <nav
      className={`app-nav app-nav-${variant}`}
      aria-label="Основная навигация"
      data-testid="app-nav"
    >
      <NavLink
        to="/"
        end
        className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
        data-testid="nav-simulation"
      >
        Симуляция
      </NavLink>
      <NavLink
        to="/documentation"
        className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
        data-testid="nav-documentation"
      >
        Документация
      </NavLink>
    </nav>
  );
}
