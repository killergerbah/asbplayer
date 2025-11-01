import { Fetcher } from '../..';
import { Yomitan } from '../../yomitan';
import { DictionaryTrack } from '../../settings';
import { useMemo } from 'react';

class SettingsAccessor {
    settings!: DictionaryTrack;

    get enabled() {
        return this.settings.enabled;
    }
    get yomitanUrl() {
        return this.settings.yomitanUrl;
    }
    get yomitanScanLength() {
        return this.settings.yomitanScanLength;
    }
    get dictionarySubtitleLemmatization() {
        return this.settings.dictionarySubtitleLemmatization;
    }
    get dictionaryAnkiWordFields() {
        return this.settings.dictionaryAnkiWordFields;
    }
    get dictionaryAnkiSentenceFields() {
        return this.settings.dictionaryAnkiSentenceFields;
    }
    get dictionaryAnkiMatureInterval() {
        return this.settings.dictionaryAnkiMatureInterval;
    }
    get dictionaryTokenStyle() {
        return this.settings.dictionaryTokenStyle;
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
