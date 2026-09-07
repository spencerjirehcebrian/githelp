import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsModal } from './ShortcutsModal';

describe('components/ShortcutsModal', () => {
  it('renders all shortcut groups and close button', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Cycle Layout (Tasks / Board / Standup)')).toBeInTheDocument();
    expect(screen.getByText('Navigate Tasks / Cards')).toBeInTheDocument();
    expect(screen.getByText('Complete Task (Mark Done)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
