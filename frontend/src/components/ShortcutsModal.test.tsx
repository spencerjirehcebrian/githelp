import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsModal } from './ShortcutsModal';

describe('components/ShortcutsModal', () => {
  it('renders all shortcut groups and close button', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Select next notification')).toBeInTheDocument();
    expect(screen.getByText('Mark as Done (Archive)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
