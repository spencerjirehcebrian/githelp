import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from './Toast';

describe('components/Toast', () => {
  it('renders toast message and handles dismissal', () => {
    const onClose = vi.fn();
    render(<Toast message="Item marked as done" type="success" onClose={onClose} />);

    expect(screen.getByText('Item marked as done')).toBeInTheDocument();
  });

  it('renders null when message is null', () => {
    const { container } = render(<Toast message={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
