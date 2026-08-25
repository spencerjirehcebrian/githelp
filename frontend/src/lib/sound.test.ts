import { describe, it, expect } from 'vitest';
import { playNotificationSound } from './sound';

describe('lib/sound', () => {
  it('should synthesize chime without crashing', () => {
    expect(() => playNotificationSound()).not.toThrow();
  });

  it('should handle missing AudioContext gracefully', () => {
    const originalAudio = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => playNotificationSound()).not.toThrow();

    Object.defineProperty(window, 'AudioContext', {
      value: originalAudio,
      configurable: true,
      writable: true,
    });
  });
});
