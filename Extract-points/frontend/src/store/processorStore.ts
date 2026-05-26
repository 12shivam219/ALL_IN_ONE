import { create } from 'zustand';

interface ProcessorState {
  inputText: string;
  processedText: string | null;
  undoStack: string[];
  redoStack: string[];
  setInputText: (text: string) => void;
  setProcessedText: (text: string | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useProcessorStore = create<ProcessorState>((set) => ({
  inputText: '',
  processedText: null,
  undoStack: [],
  redoStack: [],

  setInputText: (text) => set({ inputText: text }),

  setProcessedText: (text) => set((state) => {
    // If there is already processed text, save it in the undo stack
    const newUndoStack = state.processedText ? [...state.undoStack, state.processedText] : state.undoStack;
    return {
      processedText: text,
      undoStack: newUndoStack,
      redoStack: [] // Clear redo stack on new operation
    };
  }),

  undo: () => set((state) => {
    if (state.undoStack.length === 0) return {};
    
    const prev = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    const newRedoStack = state.processedText ? [...state.redoStack, state.processedText] : state.redoStack;
    
    return {
      processedText: prev,
      undoStack: newUndoStack,
      redoStack: newRedoStack
    };
  }),

  redo: () => set((state) => {
    if (state.redoStack.length === 0) return {};
    
    const next = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    const newUndoStack = state.processedText ? [...state.undoStack, state.processedText] : state.undoStack;
    
    return {
      processedText: next,
      undoStack: newUndoStack,
      redoStack: newRedoStack
    };
  }),

  clear: () => set({
    inputText: '',
    processedText: null,
    undoStack: [],
    redoStack: []
  })
}));
