import { PlayMode } from '@project/common';

export interface ConflictResolutionContext {
    mode: PlayMode;
    shouldResetPlaybackRate: boolean;
}

export class PlayModeManager {
    private _modes: Set<PlayMode>;
    private readonly _conflicts: [PlayMode, PlayMode][] = [[PlayMode.condensed, PlayMode.fastForward]];

    constructor(initialModes: Set<PlayMode> = new Set([PlayMode.normal])) {
        this._modes = new Set(initialModes);
        if (this._modes.size === 0) {
            this._modes.add(PlayMode.normal);
        }
    }

    getModes(): Set<PlayMode> {
        return new Set(this._modes);
    }

    has(mode: PlayMode): boolean {
        return this._modes.has(mode);
    }

    get size(): number {
        return this._modes.size;
    }

    toggle(targetMode: PlayMode, resolveConflicts?: (context: ConflictResolutionContext) => void): Set<PlayMode> {
        if (targetMode === PlayMode.normal) {
            if (this._modes.size === 1 && this._modes.has(PlayMode.normal)) {
                return this.getModes();
            }
            this._modes = new Set([PlayMode.normal]);
            return this.getModes();
        }

        if (this._modes.has(targetMode)) {
            this._modes.delete(targetMode);
            if (this._modes.size === 0) {
                this._modes.add(PlayMode.normal);
            }
        } else {
            if (this._modes.has(PlayMode.normal) && this._modes.size === 1) {
                this._modes.delete(PlayMode.normal);
            }
            this._modes.add(targetMode);
        }

        this._resolvePlayModeConflicts(targetMode, resolveConflicts);

        return this.getModes();
    }

    private _resolvePlayModeConflicts(
        newMode: PlayMode,
        onConflict?: (context: ConflictResolutionContext) => void
    ): void {
        for (const [mode1, mode2] of this._conflicts) {
            const conflictingMode = this._findConflictingMode(newMode, mode1, mode2);
            if (conflictingMode !== null) {
                const shouldResetPlaybackRate = onConflict !== undefined && conflictingMode === PlayMode.fastForward;
                if (onConflict) {
                    onConflict({ mode: conflictingMode, shouldResetPlaybackRate });
                }
                this._modes.delete(conflictingMode);
            }
        }
    }

    private _findConflictingMode(newMode: PlayMode, mode1: PlayMode, mode2: PlayMode): PlayMode | null {
        if (newMode === mode1 && this._modes.has(mode2)) {
            return mode2;
        }
        if (newMode === mode2 && this._modes.has(mode1)) {
            return mode1;
        }
        return null;
    }
}
