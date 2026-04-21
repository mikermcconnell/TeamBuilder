export interface UndoRedoHistoryState<T> {
  undoHistory: T[];
  redoHistory: T[];
}

export interface UndoRedoTransition<T> extends UndoRedoHistoryState<T> {
  nextState: T;
}

export const MAX_UNDO_REDO_HISTORY = 50;

function trimHistory<T>(entries: T[], limit: number = MAX_UNDO_REDO_HISTORY): T[] {
  if (entries.length <= limit) {
    return entries;
  }

  return entries.slice(entries.length - limit);
}

export function createEmptyUndoRedoHistory<T>(): UndoRedoHistoryState<T> {
  return {
    undoHistory: [],
    redoHistory: [],
  };
}

export function pushUndoSnapshot<T>(
  history: UndoRedoHistoryState<T>,
  currentState: T,
  limit: number = MAX_UNDO_REDO_HISTORY,
): UndoRedoHistoryState<T> {
  return {
    undoHistory: trimHistory([...history.undoHistory, currentState], limit),
    redoHistory: [],
  };
}

export function applyUndo<T>(
  history: UndoRedoHistoryState<T>,
  currentState: T,
  limit: number = MAX_UNDO_REDO_HISTORY,
): UndoRedoTransition<T> | null {
  const nextState = history.undoHistory[history.undoHistory.length - 1];

  if (nextState === undefined) {
    return null;
  }

  return {
    nextState,
    undoHistory: history.undoHistory.slice(0, history.undoHistory.length - 1),
    redoHistory: trimHistory([...history.redoHistory, currentState], limit),
  };
}

export function applyRedo<T>(
  history: UndoRedoHistoryState<T>,
  currentState: T,
  limit: number = MAX_UNDO_REDO_HISTORY,
): UndoRedoTransition<T> | null {
  const nextState = history.redoHistory[history.redoHistory.length - 1];

  if (nextState === undefined) {
    return null;
  }

  return {
    nextState,
    undoHistory: trimHistory([...history.undoHistory, currentState], limit),
    redoHistory: history.redoHistory.slice(0, history.redoHistory.length - 1),
  };
}
