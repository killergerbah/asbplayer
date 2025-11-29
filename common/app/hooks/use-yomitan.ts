import { Fetcher } from '../..';
import { Yomitan } from '../../yomitan';
import { DictionaryTrack } from '../../settings';
import { useMemo } from 'react';

class SettingsAccessor {
    settings!: DictionaryTrack;

    get dictionaryColorizeSubtitles() {
        return this.settings.dictionaryColorizeSubtitles;
    }
    get dictionaryTokenMatchStrategy() {
        return this.settings.dictionaryTokenMatchStrategy;
    }
    get dictionaryTokenMatchStrategyPriority() {
        return this.settings.dictionaryTokenMatchStrategyPriority;
    }
    get dictionaryYomitanUrl() {
        return this.settings.dictionaryYomitanUrl;
    }
    get dictionaryYomitanScanLength() {
        return this.settings.dictionaryYomitanScanLength;
    }
    get dictionaryAnkiWordFields() {
        return this.settings.dictionaryAnkiWordFields;
    }
    get dictionaryAnkiSentenceFields() {
        return this.settings.dictionaryAnkiSentenceFields;
    }
    get dictionaryAnkiSentenceTokenMatchStrategy() {
        return this.settings.dictionaryAnkiSentenceTokenMatchStrategy;
    }
    get dictionaryAnkiMatureCutoff() {
        return this.settings.dictionaryAnkiMatureCutoff;
    }
    get dictionaryAnkiTreatSuspended() {
        return this.settings.dictionaryAnkiTreatSuspended;
    }
    get tokenStyling() {
        return this.settings.tokenStyling;
    }
    get tokenStylingThickness() {
        return this.settings.tokenStylingThickness;
    }
    get colorizeFullyKnownTokens() {
        return this.settings.colorizeFullyKnownTokens;
    }
    get tokenStatusColors() {
        return this.settings.tokenStatusColors;
    }
}

const settingsAccessor = new SettingsAccessor();

// Avoid unnecessary re-renders caused from reconstructing Yomitan by having Yomitan access settings indirectly
export const useYomitan = ({ settings, fetcher }: { settings: DictionaryTrack; fetcher: Fetcher }) => {
    settingsAccessor.settings = settings;
    return useMemo(() => {
        return new Yomitan(settingsAccessor, fetcher);
    }, [fetcher]);
};
