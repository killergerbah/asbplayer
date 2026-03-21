import { VideoSubtitleSplitBehavior } from '../../settings';

interface ResolveVideoSubtitleSplitLayoutArgs {
    behavior: VideoSubtitleSplitBehavior;
    persistedWidth?: number;
    autoWidth?: number;
}

export function clampSubtitlePlayerWidth(width: number, minWidth: number, maxWidth: number) {
    return Math.min(maxWidth, Math.max(minWidth, width));
}

export function resolveVideoSubtitleSplitLayout({
    behavior,
    persistedWidth,
    autoWidth,
}: ResolveVideoSubtitleSplitLayoutArgs) {
    if (behavior === VideoSubtitleSplitBehavior.rememberSplitPosition) {
        return persistedWidth;
    }

    return autoWidth;
}
