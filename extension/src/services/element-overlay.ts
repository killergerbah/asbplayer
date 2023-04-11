export enum OffsetAnchor {
    bottom,
    top,
}

export class ElementOverlay {
    private readonly targetElement: HTMLElement;

    private readonly nonFullscreenContainerClassName: string;
    private readonly nonFullscreenContentClassName: string;
    private readonly fullscreenContainerClassName: string;
    private readonly fullscreenContentClassName: string;
    private readonly offsetAnchor: OffsetAnchor = OffsetAnchor.bottom;

    private fullscreenContainerElement?: HTMLElement;
    private fullscreenContentElement?: HTMLElement;
    private nonFullscreenContainerElement?: HTMLElement;
    private nonFullscreenContentElement?: HTMLElement;
    private nonFullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private nonFullscreenStylesInterval?: NodeJS.Timer;
    private nonFullscreenElementFullscreenPollingInterval?: NodeJS.Timer;
    private fullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private fullscreenElementFullscreenPollingInterval?: NodeJS.Timer;
    private fullscreenStylesInterval?: NodeJS.Timer;

    contentPositionOffset: number = 75;

    constructor(
        targetElement: HTMLElement,
        nonFullscreenContainerClassName: string,
        nonFullscreenContentClassName: string,
        fullscreenContainerClassName: string,
        fullscreenContentClassName: string,
        offsetAnchor: OffsetAnchor
    ) {
        this.targetElement = targetElement;
        this.nonFullscreenContainerClassName = nonFullscreenContainerClassName;
        this.nonFullscreenContentClassName = nonFullscreenContentClassName;
        this.fullscreenContainerClassName = fullscreenContainerClassName;
        this.fullscreenContentClassName = fullscreenContentClassName;
        this.offsetAnchor = offsetAnchor;
    }

    setHtml(html: string) {
        this._nonFullscreenContentElement().innerHTML = `${html}\n`;
        this._fullscreenContentElement().innerHTML = `${html}\n`;
    }

    appendHtml(html: string) {
        const currentHtml = this._nonFullscreenContentElement().innerHTML;
        const newHtml = currentHtml && currentHtml.length > 0 ? currentHtml + '<br>' + html : html;
        this._nonFullscreenContentElement().innerHTML = `${newHtml}\n`;
        this._fullscreenContentElement().innerHTML = `${newHtml}\n`;
    }

    refresh() {
        if (this.fullscreenContainerElement) {
            this._applyContainerStyles(this.fullscreenContainerElement);
        }

        if (this.nonFullscreenContainerElement) {
            this._applyContainerStyles(this.nonFullscreenContainerElement);
        }
    }

    hide() {
        if (this.nonFullscreenContentElement) {
            if (this.nonFullscreenElementFullscreenChangeListener) {
                document.removeEventListener('fullscreenchange', this.nonFullscreenElementFullscreenChangeListener);
            }

            if (this.nonFullscreenStylesInterval) {
                clearInterval(this.nonFullscreenStylesInterval);
            }

            if (this.nonFullscreenElementFullscreenPollingInterval) {
                clearInterval(this.nonFullscreenElementFullscreenPollingInterval);
            }

            this.nonFullscreenContentElement.remove();
            this.nonFullscreenContainerElement?.remove();
            this.nonFullscreenContainerElement = undefined;
            this.nonFullscreenContentElement = undefined;
        }

        if (this.fullscreenContentElement) {
            if (this.fullscreenElementFullscreenChangeListener) {
                document.removeEventListener('fullscreenchange', this.fullscreenElementFullscreenChangeListener);
            }

            if (this.fullscreenStylesInterval) {
                clearInterval(this.fullscreenStylesInterval);
            }

            if (this.fullscreenElementFullscreenPollingInterval) {
                clearInterval(this.fullscreenElementFullscreenPollingInterval);
            }

            this.fullscreenContentElement.remove();
            this.fullscreenContainerElement?.remove();
            this.fullscreenContainerElement = undefined;
            this.fullscreenContentElement = undefined;
        }
    }

    private _nonFullscreenContentElement(): HTMLElement {
        if (this.nonFullscreenContentElement) {
            return this.nonFullscreenContentElement;
        }

        const div = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(div);
        container.className = this.nonFullscreenContainerClassName;
        div.className = this.nonFullscreenContentClassName;
        this._applyContainerStyles(container);
        document.body.appendChild(container);

        function toggle() {
            if (document.fullscreenElement) {
                container.style.display = 'none';
            } else {
                container.style.display = '';
            }
        }

        toggle();
        this.nonFullscreenElementFullscreenChangeListener = (e) => toggle();
        this.nonFullscreenStylesInterval = setInterval(() => this._applyContainerStyles(container), 1000);
        this.nonFullscreenElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this.nonFullscreenElementFullscreenChangeListener);
        this.nonFullscreenContentElement = div;
        this.nonFullscreenContainerElement = container;

        return this.nonFullscreenContentElement;
    }

    private _applyContainerStyles(container: HTMLElement) {
        const rect = this.targetElement.getBoundingClientRect();
        container.style.left = rect.left + rect.width / 2 + 'px';
        container.style.maxWidth = rect.width + 'px';

        if (this.offsetAnchor === OffsetAnchor.bottom) {
            // There doesn't seem to be a way to calculate the correct bottom offset.
            // Instead, use a large offset from the top.
            container.style.top = rect.top + rect.height + window.scrollY - this.contentPositionOffset + 'px';
            container.style.bottom = '';
        } else {
            container.style.top = rect.top + window.scrollY + this.contentPositionOffset + 'px';
            container.style.bottom = '';
        }
    }

    private _fullscreenContentElement(): HTMLElement {
        if (this.fullscreenContentElement) {
            return this.fullscreenContentElement;
        }

        const div = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(div);
        container.className = this.fullscreenContainerClassName;
        div.className = this.fullscreenContentClassName;
        this._applyContainerStyles(container);
        this._findFullscreenParentElement(container).appendChild(container);
        container.style.display = 'none';
        const that = this;

        function toggle() {
            if (document.fullscreenElement && container.style.display === 'none') {
                container.style.display = '';
                container.remove();
                that._findFullscreenParentElement(container).appendChild(container);
            } else if (!document.fullscreenElement) {
                container.style.display = 'none';
            }
        }

        toggle();
        this.fullscreenElementFullscreenChangeListener = (e) => toggle();
        this.fullscreenStylesInterval = setInterval(() => this._applyContainerStyles(container), 1000);
        this.fullscreenElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this.fullscreenElementFullscreenChangeListener);
        this.fullscreenContentElement = div;
        this.fullscreenContainerElement = container;

        return this.fullscreenContentElement;
    }

    private _findFullscreenParentElement(container: HTMLElement): HTMLElement {
        const testNode = container.cloneNode(true) as HTMLElement;
        testNode.innerHTML = '&nbsp;'; // The node needs to take up some space to perform test clicks
        let current = this.targetElement.parentElement;

        if (!current) {
            return document.body;
        }

        let chosen: HTMLElement | undefined = undefined;

        do {
            const rect = current.getBoundingClientRect();

            if (
                rect.height > 0 &&
                (typeof chosen === 'undefined' ||
                    // Typescript is not smart enough to know that it's possible for 'chosen' to be defined here
                    rect.height >= (chosen as HTMLElement).getBoundingClientRect().height) &&
                this._clickable(current, testNode)
            ) {
                chosen = current;
                break;
            }

            current = current.parentElement;
        } while (current && !current.isSameNode(document.body.parentElement));

        if (chosen) {
            return chosen;
        }

        return document.body;
    }

    private _clickable(container: HTMLElement, element: HTMLElement): boolean {
        container.appendChild(element);
        const rect = element.getBoundingClientRect();
        const clickedElement = document.elementFromPoint(rect.x, rect.y);
        const clickable = element.isSameNode(clickedElement) || element.contains(clickedElement);
        element.remove();
        return clickable;
    }
}
