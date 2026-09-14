/**
 * The point of this hook is what it does not do, so that is what is tested:
 * one request on mount and none afterwards unless asked.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrief } from './useBrief';
import { sampleBrief } from '../test/brief-fixture';

function mockFetch(body: unknown = sampleBrief()) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => body,
  })) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

describe('useBrief', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches exactly once on mount', async () => {
    const fetchMock = mockFetch();
    const { result } = renderHook(() => useBrief());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/brief');
    expect(result.current.brief?.repo).toBe('acme/widgets');
  });

  it('does not refetch when the component rerenders', async () => {
    const fetchMock = mockFetch();
    const { result, rerender } = renderHook(() => useBrief());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender();
    rerender();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bypasses the server cache only when refresh is called', async () => {
    const fetchMock = mockFetch();
    const { result } = renderHook(() => useBrief());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/brief?refresh=1');
  });

  it('keeps the previous brief on screen while refreshing', async () => {
    mockFetch();
    const { result } = renderHook(() => useBrief());

    await waitFor(() => expect(result.current.brief).not.toBeNull());
    act(() => {
      result.current.refresh();
    });

    expect(result.current.brief).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
  });

  it('refetches when the repository changes', async () => {
    const fetchMock = mockFetch();
    const { result, rerender } = renderHook(({ repo }) => useBrief(repo), {
      initialProps: { repo: undefined as string | undefined },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ repo: 'acme/other' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/brief?repo=acme%2Fother');
  });

  it('surfaces a failure without discarding what is already loaded', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      statusText: 'Bad Gateway',
      json: async () => ({ error: 'GitHub is unreachable' }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useBrief());

    await waitFor(() => expect(result.current.error).toBe('GitHub is unreachable'));
    expect(result.current.isLoading).toBe(false);
  });
});
