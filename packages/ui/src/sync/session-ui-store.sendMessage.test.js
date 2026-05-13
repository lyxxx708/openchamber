import { beforeEach, describe, expect, mock, test } from 'bun:test';

const optimisticSendCalls = [];
const saveSessionAgentSelectionCalls = [];
const saveAgentModelVariantCalls = [];
const pendingAnimationCalls = [];
let viewportState = { sessionMemoryState: new Map() };

mock.module('@/lib/opencode/client', () => ({
  opencodeClient: {
    getDirectory: () => '/repo/current',
    getSdkClient: () => ({ session: { shell: () => Promise.resolve() } }),
    sendMessage: () => Promise.resolve(),
    sendCommand: () => Promise.resolve(),
  },
}));

mock.module('@/stores/useConfigStore', () => ({
  useConfigStore: {
    getState: () => ({
      currentAgentName: undefined,
      agents: [],
    }),
  },
}));

mock.module('./session-actions', () => ({
  createSession: async () => null,
  deleteSession: async () => true,
  archiveSession: async () => true,
  updateSessionTitle: async () => undefined,
  shareSession: async () => null,
  unshareSession: async () => null,
  optimisticSend: mock(async (params) => {
    optimisticSendCalls.push(params);
  }),
  refetchSessionMessages: async () => undefined,
}));

mock.module('./selection-store', () => ({
  useSelectionStore: {
    getState: () => ({
      getSessionAgentSelection: () => null,
      saveSessionAgentSelection: (sessionId, agent) => {
        saveSessionAgentSelectionCalls.push({ sessionId, agent });
      },
      saveAgentModelVariantForSession: (sessionId, agent, providerID, modelID, variant) => {
        saveAgentModelVariantCalls.push({ sessionId, agent, providerID, modelID, variant });
      },
      lastUsedProvider: null,
    }),
  },
}));

mock.module('./viewport-store', () => ({
  useViewportStore: {
    getState: () => viewportState,
    setState: (next) => {
      viewportState = { ...viewportState, ...next };
    },
  },
}));

mock.module('@/lib/userSendAnimation', () => ({
  markPendingUserSendAnimation: (sessionId) => {
    pendingAnimationCalls.push(sessionId);
  },
}));

mock.module('@/lib/worktrees/worktreeBootstrap', () => ({
  waitForWorktreeBootstrap: async () => undefined,
}));

import { useSessionUIStore } from './session-ui-store';

describe('session-ui-store sendMessage target session routing', () => {
  beforeEach(() => {
    optimisticSendCalls.length = 0;
    saveSessionAgentSelectionCalls.length = 0;
    saveAgentModelVariantCalls.length = 0;
    pendingAnimationCalls.length = 0;
    viewportState = { sessionMemoryState: new Map() };
    globalThis.fetch = mock(async () => ({ ok: true }));

    useSessionUIStore.setState({
      currentSessionId: 'session-b',
      pendingChangesBarDismissed: new Map([
        ['session-a', 'dismissed-a'],
        ['session-b', 'dismissed-b'],
      ]),
      getDirectoryForSession: (sessionId) => (sessionId === 'session-a' ? '/repo/a' : '/repo/b'),
    });
  });

  test('routes queued auto-send to the explicit target session instead of the current session', async () => {
    await useSessionUIStore.getState().sendMessage(
      'queued message',
      'provider-a',
      'model-a',
      'Builder',
      undefined,
      undefined,
      undefined,
      undefined,
      'normal',
      'session-a',
    );

    expect(optimisticSendCalls).toHaveLength(1);
    expect(optimisticSendCalls[0].sessionId).toBe('session-a');

    expect(saveSessionAgentSelectionCalls).toHaveLength(1);
    expect(saveSessionAgentSelectionCalls[0].sessionId).toBe('session-a');

    expect(saveAgentModelVariantCalls).toHaveLength(1);
    expect(saveAgentModelVariantCalls[0].sessionId).toBe('session-a');

    expect(pendingAnimationCalls).toHaveLength(1);
    expect(pendingAnimationCalls[0]).toBe('session-a');

    expect(useSessionUIStore.getState().pendingChangesBarDismissed.has('session-a')).toBe(false);
    expect(useSessionUIStore.getState().pendingChangesBarDismissed.has('session-b')).toBe(true);
    expect(viewportState.sessionMemoryState.has('session-a')).toBe(true);
    expect(viewportState.sessionMemoryState.has('session-b')).toBe(false);
  });
});
