import { Fetcher } from '../..';
import { Yomitan } from '../../yomitan';
import { DictionaryTrack } from '../../settings';
import { useMemo } from 'react';

class SettingsAccessor {
    settings!: DictionaryTrack;

    get dictionaryColorizeOnVideo() {
        return this.settings.dictionaryColorizeOnVideo;
    }
    get dictionaryColorizeOnApp() {
        return this.settings.dictionaryColorizeOnApp;
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
    get dictionaryAnkiEnabled() {
        return this.settings.dictionaryAnkiEnabled;
    }
    get dictionaryAnkiConnectUrl() {
        return this.settings.dictionaryAnkiConnectUrl;
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
    get dictionaryVideoSubtitleAppearance() {
        return this.settings.dictionaryVideoSubtitleAppearance;
    }
    get dictionaryAppSubtitleAppearance() {
        return this.settings.dictionaryAppSubtitleAppearance;
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
