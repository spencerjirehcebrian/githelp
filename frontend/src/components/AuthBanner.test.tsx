import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthBanner } from './AuthBanner';

describe('components/AuthBanner', () => {
  it('renders warning banner when unauthenticated', () => {
    render(
      <AuthBanner
        auth={{ authenticated: false, auth_mode: 'gh_cli', error_message: 'gh not found' }}
        onOpenSettings={vi.fn()}
      />
    );

    expect(screen.getByText('GitHub Authentication Required:')).toBeInTheDocument();
    expect(screen.getByText('Configure Token')).toBeInTheDocument();
  });

  it('renders null when authenticated', () => {
    const { container } = render(
      <AuthBanner
        auth={{ authenticated: true, auth_mode: 'gh_cli' }}
        onOpenSettings={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
