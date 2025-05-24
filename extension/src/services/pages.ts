import pagesConfig from '../pages.json';
import type { PublicPath } from 'wxt/browser';
import { isOnTutorialPage } from './tutorial';

interface PageConfig {
    // Regex for URLs where script should be loaded
    host: string;

    // Script to load
    script?: string;

    // URL relative path regex where subtitle track data syncing is allowed
    path?: string;

    // URL hash segment regex where subtitle track data syncing is allowed
    hash?: string;

    // Whether shadow roots should be searched for video elements on this page
    searchShadowRoots?: boolean;

    // Whether video elements with blank src should be bindable on this page
    allowBlankSrc?: boolean;

    autoSync?: {
        // Whether to attempt to load detected subtitles automatically
        enabled: boolean;

        // Video src string regex for video elemennts that should be considered for auto-syync
        videoSrc?: string;

        // Video element ID regex for video elements that should be considered for auto-sync
        elementId?: string;
    };

    ignore?: {
        // CSS classes that should cause video elements to be ignored for binding
        class?: string;
        // Styles that should cause video elements to be ignored for binding
        style?: { [key: string]: string };
    };
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
                script: 'asbplayer-tutorial-page.js',
                path: '.*',
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
        if (this.config.script === undefined) {
            return;
        }

        const s = document.createElement('script');
        s.src = browser.runtime.getURL(`${this.config.script}` as PublicPath);
        s.onload = () => s.remove();
        (document.head || document.documentElement).appendChild(s);
    }

    shouldIgnore(element: HTMLMediaElement) {
        if (this.config.ignore === undefined) {
            return false;
        }

        if (this.config.ignore.class !== undefined && element.classList.contains(this.config.ignore.class)) {
            return true;
        }

        if (this.config.ignore.style !== undefined) {
            for (const key of Object.keys(this.config.ignore.style)) {
                if (element.style[key as keyof CSSStyleDeclaration] === this.config.ignore.style[key]) {
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
        if (this.config.hash) {
            hashMatch = new RegExp(this.config.hash).test(this.url.hash);
        }
        if (this.config.path) {
            pathMatch = new RegExp(this.config.path).test(this.url.pathname);
        }
        return hashMatch && pathMatch;
    }
}
