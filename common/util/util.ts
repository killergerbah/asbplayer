import sanitize from 'sanitize-filename';
import { Rgb, SubtitleModel } from '../src/model';
import { TextSubtitleSettings } from '../settings/settings';

export function humanReadableTime(timestamp: number, nearestTenth = false): string {
    const totalSeconds = Math.floor(timestamp / 1000);
    let seconds;

    if (nearestTenth) {
        seconds = Math.round(((timestamp / 1000) % 60) * 10) / 10;
    } else {
        seconds = totalSeconds % 60;
    }

    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    if (hours > 0) {
        return hours + 'h' + String(minutes).padStart(2, '0') + 'm' + String(seconds).padStart(2, '0') + 's';
    }

    return minutes + 'm' + String(seconds).padStart(2, '0') + 's';
}

export function surroundingSubtitles(
    subtitles: SubtitleModel[],
    index: number,
    countRadius: number,
    timeRadius: number
): SubtitleModel[] {
    let startIndex = index;

    for (let i = index; i >= 0; --i) {
        startIndex = i;

        if (atBoundary(subtitles, startIndex, index, countRadius, timeRadius, Direction.backward)) {
            break;
        }
    }

    let endIndex = startIndex;

    for (let i = index; i <= subtitles.length - 1; ++i) {
        endIndex = i;

        if (atBoundary(subtitles, endIndex, index, countRadius, timeRadius, Direction.forward)) {
            break;
        }
    }

    return subtitles.slice(startIndex, endIndex + 1);
}

function indexNearTimestamp(subtitles: SubtitleModel[], timestamp: number, direction: Direction) {
    if (direction === Direction.forward) {
        for (let i = 0; i < subtitles.length; ++i) {
            if (subtitles[i].start >= timestamp) {
                return i;
            }
        }
    } else {
        for (let i = subtitles.length - 1; i >= 0; --i) {
            if (subtitles[i].start <= timestamp) {
                return i;
            }
        }
    }

    return undefined;
}

export function surroundingSubtitlesAroundInterval(
    subtitles: SubtitleModel[],
    startTimestamp: number,
    endTimestamp: number,
    countRadius: number,
    timeRadius: number
) {
    if (subtitles.length === 0) {
        return {};
    }

    let startBoundaryIndex = 0;
    const indexAfterStartTimestamp =
        indexNearTimestamp(subtitles, startTimestamp, Direction.forward) ?? subtitles.length - 1;

    for (let i = 0; i < subtitles.length; ++i) {
        startBoundaryIndex = i;

        if (
            withinBoundaryAroundInterval(
                subtitles,
                i,
                countRadius,
                timeRadius,
                startTimestamp,
                indexAfterStartTimestamp
            )
        ) {
            break;
        }
    }

    let endBoundaryIndex = subtitles.length - 1;
    const indexBeforeEndTimestamp = indexNearTimestamp(subtitles, endTimestamp, Direction.backward) ?? 0;

    for (let i = subtitles.length - 1; i >= 0; --i) {
        endBoundaryIndex = i;

        if (
            withinBoundaryAroundInterval(subtitles, i, countRadius, timeRadius, endTimestamp, indexBeforeEndTimestamp)
        ) {
            break;
        }
    }

    if (endBoundaryIndex <= startBoundaryIndex) {
        return {};
    }

    return {
        surroundingSubtitles: subtitles.slice(startBoundaryIndex, endBoundaryIndex + 1),
        subtitle: subtitles[indexAfterStartTimestamp],
    };
}

export function mockSurroundingSubtitles(
    middleSubtitle: SubtitleModel,
    maxTimestamp: number,
    timeRadius: number
): SubtitleModel[] {
    const subtitles = [middleSubtitle];
    const offset = middleSubtitle.start - middleSubtitle.originalStart;

    if (middleSubtitle.end < maxTimestamp) {
        const afterTimestamp = Math.min(maxTimestamp, middleSubtitle.end + timeRadius);
        subtitles.push({
            text: '',
            start: middleSubtitle.end,
            end: afterTimestamp,
            originalStart: middleSubtitle.end - offset,
            originalEnd: afterTimestamp - offset,
            track: middleSubtitle.track,
        });
    }

    if (middleSubtitle.start > 0) {
        const beforeTimestamp = Math.max(0, middleSubtitle.start - timeRadius);
        subtitles.unshift({
            text: '',
            start: beforeTimestamp,
            end: middleSubtitle.start,
            originalStart: beforeTimestamp - offset,
            originalEnd: middleSubtitle.start - offset,
            track: middleSubtitle.track,
        });
    }

    return subtitles;
}

enum Direction {
    forward,
    backward,
}

function atBoundary(
    subtitles: SubtitleModel[],
    index: number,
    initialIndex: number,
    countRadius: number,
    timeRadius: number,
    direction: Direction
): boolean {
    let next;

    if (direction == Direction.forward) {
        next = index + 1 < subtitles.length ? subtitles[index + 1] : null;
    } else {
        next = index - 1 >= 0 ? subtitles[index - 1] : null;
    }

    if (
        Math.abs(initialIndex - index) >= countRadius &&
        (next === null || Math.abs(next.start - subtitles[initialIndex].start) >= timeRadius)
    ) {
        return true;
    }

    return false;
}

function withinBoundaryAroundInterval(
    subtitles: SubtitleModel[],
    index: number,
    countRadius: number,
    timeRadius: number,
    timestamp: number,
    indexNearTimestamp: number
): boolean {
    const current = subtitles[index];

    if (Math.abs(indexNearTimestamp - index) <= countRadius || Math.abs(current.start - timestamp) <= timeRadius) {
        return true;
    }

    return false;
}

export function subtitleIntersectsTimeInterval(subtitle: SubtitleModel, interval: number[]) {
    const length = Math.max(0, subtitle.end - subtitle.start);

    if (length === 0) {
        return false;
    }

    const overlapStart = Math.max(subtitle.start, interval[0]);
    const overlapEnd = Math.min(subtitle.end, interval[1]);

    return overlapEnd - overlapStart >= length / 2;
}

export function joinSubtitles(subtitles: SubtitleModel[]) {
    return subtitles
        .filter((s) => s.text.trim() !== '')
        .map((s) => s.text)
        .join('\n');
}

export function extractText(subtitle: SubtitleModel, surroundingSubtitles: SubtitleModel[], track?: number) {
    if (surroundingSubtitles.length === 0) {
        return subtitle.text;
    }

    const interval = [subtitle.start, subtitle.end];
    return joinSubtitles(
        surroundingSubtitles
            .filter((s) => subtitleIntersectsTimeInterval(s, interval))
            .filter((s) => track === undefined || s.track === track)
    );
}

export function download(blob: Blob, name: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = sanitize(name);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}

export function computeStyles({
    subtitleColor,
    subtitleSize,
    subtitleThickness,
    subtitleOutlineThickness,
    subtitleOutlineColor,
    subtitleShadowThickness,
    subtitleShadowColor,
    subtitleBackgroundOpacity,
    subtitleBackgroundColor,
    subtitleFontFamily,
    subtitleCustomStyles,
}: TextSubtitleSettings) {
    const styles: { [key: string]: any } = {
        color: subtitleColor,
        fontSize: `${subtitleSize}px`,
        fontWeight: String(subtitleThickness),
    };

    if (subtitleOutlineThickness > 0) {
        const thickness = subtitleOutlineThickness;
        const color = subtitleOutlineColor;
        styles['WebkitTextStroke'] = `${color} ${thickness}px`;
        styles['paintOrder'] = `stroke fill`;
    }

    if (subtitleShadowThickness > 0) {
        styles['textShadow'] =
            `0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}, 0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}, 0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}, 0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}`;
    }

    if (subtitleBackgroundOpacity > 0) {
        const opacity = subtitleBackgroundOpacity;
        const color = subtitleBackgroundColor;
        const { r, g, b } = hexToRgb(color);
        styles['backgroundColor'] = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    if (subtitleFontFamily && subtitleFontFamily.length > 0) {
        styles['fontFamily'] = `'${subtitleFontFamily}'`;
    }

    for (const customStyle of subtitleCustomStyles) {
        let key;

        if (
            customStyle.key.startsWith('webkit') ||
            customStyle.key.startsWith('moz') ||
            customStyle.key.startsWith('ms') ||
            /^o[A-Z].*/.test(customStyle.key)
        ) {
            key = customStyle.key.charAt(0).toUpperCase() + customStyle.key.slice(1);
        } else {
            key = customStyle.key;
        }

        if (!isNumeric(key)) {
            // A bug has allowed style keys that look like '0', '1',... to make it into some users' settings
            // Using such a style key with react crashes the app, so filter them out here
            styles[key] = customStyle.value;
        }
    }

    return styles;
}

export function isNumeric(str: string) {
    return !isNaN(Number(str));
}

// https://stackoverflow.com/questions/63116039/camelcase-to-kebab-case
function kebabize(str: string) {
    const kebabized = str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase());

    if (
        kebabized.startsWith('webkit-') ||
        kebabized.startsWith('moz-') ||
        kebabized.startsWith('ms-') ||
        kebabized.startsWith('o-')
    ) {
        return `-${kebabized}`;
    }

    return kebabized;
}

export function computeStyleString(styleSettings: TextSubtitleSettings) {
    const stylesMap = computeStyles(styleSettings);
    const styleList = [];

    for (const [key, value] of Object.entries(stylesMap)) {
        styleList.push(`${kebabize(key)}: ${value} !important`);
    }

    return styleList.join(';');
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
export function hexToRgb(hex: string): Rgb {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    if (!result) {
        return { r: 255, g: 255, b: 255 };
    }

    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    };
}

export function sourceString(subtitleFileName: string, timestamp: number) {
    return timestamp === 0 ? subtitleFileName : `${subtitleFileName} (${humanReadableTime(timestamp)})`;
}

export function seekWithNudge(media: HTMLMediaElement, timestampSeconds: number) {
    media.currentTime = timestampSeconds;

    if (media.currentTime < timestampSeconds) {
        // Seeking is imprecise and may not land on the desired timestamp
        // Favor seeking slightly ahead to avoid getting stuck when seeking between subtitles
        media.currentTime = Math.min(media.duration, media.currentTime + 0.01);
    }

    return media.currentTime;
}
