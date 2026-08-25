import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnoozeModal } from './SnoozeModal';

describe('components/SnoozeModal', () => {
  it('renders presets and triggers onSnooze on selection', () => {
    const onSnooze = vi.fn();
    const onClose = vi.fn();

    render(
      <SnoozeModal
        isOpen={true}
        notificationId="notif-1"
        onClose={onClose}
        onSnooze={onSnooze}
      />
    );

    expect(screen.getByText('Snooze Notification')).toBeInTheDocument();
    expect(screen.getByText('1 Hour')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow Morning')).toBeInTheDocument();

    fireEvent.click(screen.getByText('1 Hour'));
    expect(onSnooze).toHaveBeenCalledWith('notif-1', expect.any(Date));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SnoozeModal
        isOpen={false}
        notificationId="notif-1"
        onClose={vi.fn()}
        onSnooze={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
