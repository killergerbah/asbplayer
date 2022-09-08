import { Anki, AnkiSettings, AudioClip, AudioModel, Image, ImageModel, SubtitleModel } from '@project/common';

export default async function updateLastCard(
    ankiSettings: AnkiSettings,
    subtitle: SubtitleModel,
    audioModel: AudioModel | undefined,
    imageModel: ImageModel | undefined,
    sourceString: string,
    url: string | undefined
) {
    const anki = new Anki(ankiSettings);
    let audioClip =
        audioModel === undefined
            ? undefined
            : AudioClip.fromBase64(sourceString, subtitle.start, subtitle.end, audioModel.base64, audioModel.extension);

    if (audioClip !== undefined && ankiSettings.preferMp3) {
        audioClip = audioClip.toMp3();
    }

    return await anki.export(
        subtitle.text,
        undefined,
        audioClip,
        imageModel === undefined
            ? undefined
            : Image.fromBase64(sourceString, subtitle.start, imageModel.base64, imageModel.extension),
        undefined,
        sourceString,
        url,
        {},
        ankiSettings.tags,
        'updateLast'
    );
}
