import pagesConfig from '../pages.json';
import type { PublicPath } from 'wxt/browser';
import { isOnTutorialPage } from './tutorial';

interface PageConfig {
    // Regex for URLs where script should be loaded
    host: string;

    // Page script to load
    pageScript?: string;

    // URL relative path regex where subtitle track data syncing is allowed
    syncAllowedAtPath?: string;

    // URL hash segment regex where subtitle track data syncing is allowed
    syncAllowedAtHash?: string;

    // Whether shadow roots should be searched for video elements on this page
    searchShadowRootsForVideoElements?: boolean;

    // Whether video elements with blank src should be bindable on this page
    allowVideoElementsWithBlankSrc?: boolean;

    autoSync?: {
        // Whether to attempt to load detected subtitles automatically
        enabled: boolean;

        // Video src string regex for video elements that should be considered for auto-sync
        videoSrc?: string;

        // Video element ID regex for video elements that should be considered for auto-sync
        elementId?: string;
    };

    ignoreVideoElements?: {
        // CSS classes that should cause video elements to be ignored for binding
        class?: string;
        // Styles that should cause video elements to be ignored for binding
        style?: { [key: string]: string };
    };

    // Whether to hide "remember track preferences" toggle
    hideRememberTrackPreferenceToggle?: boolean;
}

export function currentPageDelegate(): PageDelegate | undefined {
    const urlObj = new URL(window.location.href);

    for (const page of pagesConfig.pages) {
        const regex = new RegExp(page.host);

        if (regex.test(urlObj.host)) {
            return new PageDelegate(page, urlObj);
        }
    }

    if (isOnTutorialPage()) {
        return new PageDelegate(
            {
                host: window.location.host,
                pageScript: 'asbplayer-tutorial-page.js',
                syncAllowedAtPath: '.*',
                autoSync: {
                    enabled: false,
                },
            },
            urlObj
        );
    }

    return undefined;
}

export class PageDelegate {
    readonly config: PageConfig;
    readonly url: URL;

    constructor(config: PageConfig, url: URL) {
        this.config = config;
        this.url = url;
    }

    loadScripts() {
        if (this.config.pageScript === undefined) {
            return;
        }

        const s = document.createElement('script');
        s.src = browser.runtime.getURL(`${this.config.pageScript}` as PublicPath);
        s.onload = () => s.remove();
        (document.head || document.documentElement).appendChild(s);
    }

    shouldIgnore(element: HTMLMediaElement) {
        if (this.config.ignoreVideoElements === undefined) {
            return false;
        }

        if (
            this.config.ignoreVideoElements.class !== undefined &&
            element.classList.contains(this.config.ignoreVideoElements.class)
        ) {
            return true;
        }

        if (this.config.ignoreVideoElements.style !== undefined) {
            for (const key of Object.keys(this.config.ignoreVideoElements.style)) {
                if (element.style[key as keyof CSSStyleDeclaration] === this.config.ignoreVideoElements.style[key]) {
                    return true;
                }
            }
        }

        return false;
    }

    canAutoSync(element: HTMLMediaElement) {
        return (
            this.config.autoSync !== undefined &&
            this.config.autoSync.enabled &&
            (this.config.autoSync.elementId === undefined || element.id === this.config.autoSync.elementId) &&
            (this.config.autoSync.videoSrc === undefined || new RegExp(this.config.autoSync.videoSrc).test(element.src))
        );
    }

    isVideoPage() {
        var hashMatch = true;
        var pathMatch = true;
        if (this.config.syncAllowedAtHash) {
            hashMatch = new RegExp(this.config.syncAllowedAtHash).test(this.url.hash);
        }
        if (this.config.syncAllowedAtPath) {
            pathMatch = new RegExp(this.config.syncAllowedAtPath).test(this.url.pathname);
        }
        return hashMatch && pathMatch;
    }
}
