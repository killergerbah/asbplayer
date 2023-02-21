import sanitize from 'sanitize-filename';
import { SubtitleModel } from './Model';

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

export function extractText(subtitle: SubtitleModel, surroundingSubtitles: SubtitleModel[]) {
    if (surroundingSubtitles.length === 0) {
        return subtitle.text;
    }

    const interval = [subtitle.start, subtitle.end];
    return joinSubtitles(surroundingSubtitles.filter((s) => subtitleIntersectsTimeInterval(s, interval)));
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
