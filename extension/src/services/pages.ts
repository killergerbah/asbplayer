import pagesConfig from '../pages.json';

interface PageConfig {
    host: string;
    script: string;
    path?: string;
    hash?: string;
    autoSync: {
        enabled: boolean;
        videoSrc?: string;
        elementId?: string;
    };
    ignore?: {
        class?: string;
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
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(`pages/${this.config.script}`);
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
            this.config.autoSync.enabled &&
            (this.config.autoSync.elementId === undefined || element.id === this.config.autoSync.elementId) &&
            (this.config.autoSync.videoSrc === undefined || new RegExp(this.config.autoSync.videoSrc).test(element.src))
        );
    }

    isVideoPage() {
        var hashMatch = true;
        var pathMatch = true
        if (this.config.hash) {
            hashMatch = new RegExp(this.config.hash).test(this.url.hash);
        }
        if (this.config.path) {
            pathMatch = new RegExp(this.config.path).test(this.url.pathname);
        }
        return hashMatch && pathMatch;
    }
}
