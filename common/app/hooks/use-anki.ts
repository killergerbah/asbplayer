import { Fetcher } from '../..';
import { Anki } from '../../anki';
import { AnkiSettings } from '../../settings';
import { useMemo } from 'react';

export const useAnki = ({ settings, fetcher }: { settings: AnkiSettings; fetcher: Fetcher }) => {
    const {
        ankiConnectUrl,
        deck,
        noteType,
        sentenceField,
        definitionField,
        audioField,
        imageField,
        wordField,
        sourceField,
        urlField,
        customAnkiFields,
        tags,
        preferMp3,
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
    } = settings;
    return useMemo(() => {
        return new Anki(
            {
                ankiConnectUrl,
                deck,
                noteType,
                sentenceField,
                definitionField,
                audioField,
                imageField,
                wordField,
                sourceField,
                urlField,
                customAnkiFields,
                tags,
                preferMp3,
                audioPaddingStart,
                audioPaddingEnd,
                maxImageWidth,
                maxImageHeight,
                surroundingSubtitlesCountRadius,
                surroundingSubtitlesTimeRadius,
            },
            fetcher
        );
    }, [
        ankiConnectUrl,
        deck,
        noteType,
        sentenceField,
        definitionField,
        audioField,
        imageField,
        wordField,
        sourceField,
        urlField,
        customAnkiFields,
        tags,
        preferMp3,
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
        fetcher,
    ]);
};
