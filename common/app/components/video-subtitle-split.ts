import { VideoSubtitleSplitBehavior } from '../../settings';

interface ResolveVideoSubtitleSplitLayoutArgs {
    behavior: VideoSubtitleSplitBehavior;
    persistedWidth: number;
    autoWidth?: number;
    videoFileUrl?: string;
    appBarHidden: boolean;
    appBarHeight: number;
}

interface VideoSubtitleSplitLayout {
    initialWidth?: number;
    initialWidthKey?: string;
}

export function clampSubtitlePlayerWidth(width: number, minWidth: number, maxWidth: number) {
    return Math.min(maxWidth, Math.max(minWidth, width));
}

export function resolveVideoSubtitleSplitLayout({
    behavior,
    persistedWidth,
    autoWidth,
    videoFileUrl,
    appBarHidden,
    appBarHeight,
}: ResolveVideoSubtitleSplitLayoutArgs): VideoSubtitleSplitLayout {
    if (!videoFileUrl) {
        return {};
    }

    if (behavior === VideoSubtitleSplitBehavior.rememberSplitPosition) {
        return {
            initialWidth: persistedWidth > 0 ? persistedWidth : autoWidth,
            initialWidthKey: `remember:${persistedWidth}`,
        };
    }

    return {
        initialWidth: autoWidth,
        initialWidthKey: `auto:${videoFileUrl}|${appBarHidden}|${appBarHeight}`,
    };
}
