import Overlay, { OverlayOptions } from './Overlay';

export enum OffsetAnchor {
    bottom,
    top,
}

export class TextOverlay {
    private readonly _overlay: Overlay;
    private readonly _offsetAnchor: OffsetAnchor = OffsetAnchor.bottom;
    private _stylesInterval?: NodeJS.Timer;

    contentPositionOffset: number = 75;

    constructor(targetElement: HTMLElement, overlayOptions: OverlayOptions, offsetAnchor: OffsetAnchor) {
        this._overlay = new Overlay(targetElement, {
            ...overlayOptions,
            onNonFullscreenContainerElementCreated: (container) => {
                this._applyNonFullscreenStyles(container);

                if (this._stylesInterval) {
                    clearInterval(this._stylesInterval);
                }

                this._stylesInterval = setInterval(() => this._applyNonFullscreenStyles(container), 1000);
            },
            onFullscreenContainerElementCreated: (container) => this._applyFullscreenStyles(container),
        });
        this._offsetAnchor = offsetAnchor;
    }

    setHtml(html: string) {
        this._overlay.setHtml(html);
    }

    appendHtml(html: string) {
        this._overlay.appendHtml(html);
    }

    refresh() {
        if (this._overlay.fullscreenContainerElement) {
            this._applyFullscreenStyles(this._overlay.fullscreenContainerElement);
        }

        if (this._overlay.nonFullscreenContainerElement) {
            this._applyNonFullscreenStyles(this._overlay.nonFullscreenContainerElement);
        }
    }

    hide() {
        if (this._stylesInterval) {
            clearInterval(this._stylesInterval);
        }

        this._overlay.remove();
    }

    private _applyNonFullscreenStyles(container: HTMLElement) {
        const rect = this._overlay.targetElement.getBoundingClientRect();
        container.style.left = rect.left + rect.width / 2 + 'px';
        container.style.maxWidth = rect.width + 'px';

        if (this._offsetAnchor === OffsetAnchor.bottom) {
            // There doesn't seem to be a way to calculate the correct bottom offset.
            // Instead, use a large offset from the top.
            container.style.top = rect.top + rect.height + window.scrollY - this.contentPositionOffset + 'px';
            container.style.bottom = '';
        } else {
            container.style.top = rect.top + window.scrollY + this.contentPositionOffset + 'px';
            container.style.bottom = '';
        }
    }

    private _applyFullscreenStyles(container: HTMLElement) {
        container.style.maxWidth = '100%';

        if (this._offsetAnchor === OffsetAnchor.bottom) {
            container.style.top = '';
            container.style.bottom = this.contentPositionOffset + 'px';
        } else {
            container.style.top = this.contentPositionOffset + 'px';
            container.style.bottom = '';
        }
    }
}
