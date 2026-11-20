import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/** Top row of a screen: optional back link on the left, actions on the right. */
export function Header({ back, children }: { back?: string; children?: ReactNode }) {
  return (
    <div className="header">
      {back && (
        <Link className="icon-btn" to={back} aria-label="Wróć">
          <Icon name="back" />
        </Link>
      )}
      <span className="spacer" />
      {children}
    </div>
  );
}
