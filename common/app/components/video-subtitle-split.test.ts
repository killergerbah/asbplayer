import { VideoSubtitleSplitBehavior } from '@project/common/settings';
import { clampSubtitlePlayerWidth, resolveVideoSubtitleSplitLayout } from './video-subtitle-split';

it('uses the saved split width in remember mode', () => {
    expect(
        resolveVideoSubtitleSplitLayout({
            behavior: VideoSubtitleSplitBehavior.rememberSplitPosition,
            persistedWidth: 420,
            autoWidth: 300,
            videoFileUrl: 'blob:video',
            appBarHidden: false,
            appBarHeight: 64,
        })
    ).toEqual({
        initialWidth: 420,
        initialWidthKey: 'remember:420',
    });
});

it('falls back to the auto width in remember mode when nothing has been saved', () => {
    expect(
        resolveVideoSubtitleSplitLayout({
            behavior: VideoSubtitleSplitBehavior.rememberSplitPosition,
            persistedWidth: -1,
            autoWidth: 300,
            videoFileUrl: 'blob:video',
            appBarHidden: false,
            appBarHeight: 64,
        })
    ).toEqual({
        initialWidth: 300,
        initialWidthKey: 'remember:-1',
    });
});

it('ignores saved width in auto-maximize mode', () => {
    expect(
        resolveVideoSubtitleSplitLayout({
            behavior: VideoSubtitleSplitBehavior.autoMaximizeVideo,
            persistedWidth: 420,
            autoWidth: 300,
            videoFileUrl: 'blob:video',
            appBarHidden: true,
            appBarHeight: 0,
        })
    ).toEqual({
        initialWidth: 300,
        initialWidthKey: 'auto:blob:video|true|0',
    });
});

it('clamps split width to the current bounds', () => {
    expect(clampSubtitlePlayerWidth(150, 200, 500)).toBe(200);
    expect(clampSubtitlePlayerWidth(600, 200, 500)).toBe(500);
});
