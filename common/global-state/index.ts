// The app and extension currently share settings via extension storage.
// However, each setting can have different values per profile.
// "Global state" exists for other kinds of key/value pairs that should
// not be affected by settings profiles. For example: FTUE state.

export const initialGlobalState: GlobalState = {
    ftueHasSeenAnkiDialogQuickSelect: false,
};

export interface GlobalState {
    ftueHasSeenAnkiDialogQuickSelect: boolean;
}

export interface GlobalStateProvider {
    getAll: () => Promise<GlobalState>;
    get: <K extends keyof GlobalState>(keys: K[]) => Promise<Pick<GlobalState, K>>;
    set: (state: Partial<GlobalState>) => Promise<void>;
}
