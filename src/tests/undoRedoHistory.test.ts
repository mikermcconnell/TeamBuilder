import { describe, expect, it } from 'vitest';

import {
  applyRedo,
  applyUndo,
  createEmptyUndoRedoHistory,
  pushUndoSnapshot,
} from '@/utils/undoRedoHistory';

describe('undoRedoHistory', () => {
  it('undoes a change and then reapplies it with redo', () => {
    const initialState = { players: [] as string[] };
    const addedPlayerState = { players: ['Alex'] };

    const historyAfterEdit = pushUndoSnapshot(createEmptyUndoRedoHistory<typeof initialState>(), initialState);
    const undoResult = applyUndo(historyAfterEdit, addedPlayerState);

    expect(undoResult?.nextState).toEqual(initialState);
    expect(undoResult?.redoHistory).toEqual([addedPlayerState]);

    const redoResult = applyRedo(
      {
        undoHistory: undoResult?.undoHistory ?? [],
        redoHistory: undoResult?.redoHistory ?? [],
      },
      undoResult?.nextState ?? initialState,
    );

    expect(redoResult?.nextState).toEqual(addedPlayerState);
  });

  it('clears redo history after a new edit follows undo', () => {
    const baseState = { version: 1 };
    const secondState = { version: 2 };
    const thirdState = { version: 3 };

    const history = pushUndoSnapshot(
      pushUndoSnapshot(createEmptyUndoRedoHistory<typeof baseState>(), baseState),
      secondState,
    );

    const undoResult = applyUndo(history, thirdState);
    expect(undoResult?.redoHistory).toEqual([thirdState]);

    const afterNewEdit = pushUndoSnapshot(
      {
        undoHistory: undoResult?.undoHistory ?? [],
        redoHistory: undoResult?.redoHistory ?? [],
      },
      undoResult?.nextState ?? secondState,
    );

    expect(afterNewEdit.redoHistory).toEqual([]);
  });

  it('preserves the correct order across repeated undo and redo actions', () => {
    const state1 = { step: 1 };
    const state2 = { step: 2 };
    const state3 = { step: 3 };

    let history = createEmptyUndoRedoHistory<typeof state1>();
    history = pushUndoSnapshot(history, state1);
    history = pushUndoSnapshot(history, state2);

    const undoFromState3 = applyUndo(history, state3);
    expect(undoFromState3?.nextState).toEqual(state2);

    const undoFromState2 = applyUndo(
      {
        undoHistory: undoFromState3?.undoHistory ?? [],
        redoHistory: undoFromState3?.redoHistory ?? [],
      },
      undoFromState3?.nextState ?? state2,
    );
    expect(undoFromState2?.nextState).toEqual(state1);

    const redoBackToState2 = applyRedo(
      {
        undoHistory: undoFromState2?.undoHistory ?? [],
        redoHistory: undoFromState2?.redoHistory ?? [],
      },
      undoFromState2?.nextState ?? state1,
    );
    expect(redoBackToState2?.nextState).toEqual(state2);

    const redoBackToState3 = applyRedo(
      {
        undoHistory: redoBackToState2?.undoHistory ?? [],
        redoHistory: redoBackToState2?.redoHistory ?? [],
      },
      redoBackToState2?.nextState ?? state2,
    );
    expect(redoBackToState3?.nextState).toEqual(state3);
  });

  it('resets both history stacks when a fresh history state is created', () => {
    const emptyHistory = createEmptyUndoRedoHistory<{ value: number }>();

    expect(emptyHistory.undoHistory).toEqual([]);
    expect(emptyHistory.redoHistory).toEqual([]);
  });
});
