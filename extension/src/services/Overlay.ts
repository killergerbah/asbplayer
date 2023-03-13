export interface OverlayOptions {
    nonFullscreenContainerClassName?: string;
    nonFullscreenContentClassName?: string;
    fullscreenContainerClassName?: string;
    fullscreenContentClassName?: string;
    onNonFullscreenContainerElementCreated?: (container: HTMLElement) => void;
    onFullscreenContainerElementCreated?: (container: HTMLElement) => void;
}

export default class Overlay {
    private readonly _targetElement: HTMLElement;

    private readonly _nonFullscreenContainerClassName?: string;
    private readonly _nonFullscreenContentClassName?: string;
    private readonly _fullscreenContainerClassName?: string;
    private readonly _fullscreenContentClassName?: string;
    private readonly _onContainerElementCreated?: (container: HTMLElement) => void;
    private readonly _onFullscreenContainerElementCreated?: (container: HTMLElement) => void;

    private _fullscreenContainerElement?: HTMLElement;
    private _fullscreenContentElement?: HTMLElement;
    private _nonFullscreenContainerElement?: HTMLElement;
    private _nonFullscreenContentElement?: HTMLElement;
    private _nonFullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private _nonFullscreenElementFullscreenPollingInterval?: NodeJS.Timer;
    private _fullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private _fullscreenElementFullscreenPollingInterval?: NodeJS.Timer;
    private _childElement?: HTMLElement;

    contentPositionOffset: number = 75;

    constructor(targetElement: HTMLElement, options: OverlayOptions) {
        this._targetElement = targetElement;
        this._nonFullscreenContainerClassName = options.nonFullscreenContainerClassName;
        this._nonFullscreenContentClassName = options.nonFullscreenContentClassName;
        this._fullscreenContainerClassName = options.fullscreenContainerClassName;
        this._fullscreenContentClassName = options.fullscreenContentClassName;
        this._onContainerElementCreated = options.onNonFullscreenContainerElementCreated;
        this._onFullscreenContainerElementCreated = options.onFullscreenContainerElementCreated;
    }

    get targetElement() {
        return this._targetElement;
    }

    get fullscreenContainerElement() {
        return this._fullscreenContainerElement;
    }

    get fullscreenContentElement() {
        return this._fullscreenContentElement;
    }

    get nonFullscreenContainerElement() {
        return this._nonFullscreenContainerElement;
    }

    get nonFullscreenContentElement() {
        return this._nonFullscreenContentElement;
    }

    setHtml(html: string) {
        this._getNonFullscreenContentElement().innerHTML = `${html}\n`;
        this._getFullscreenContentElement().innerHTML = `${html}\n`;
    }

    appendHtml(html: string) {
        const currentHtml = this._getNonFullscreenContentElement().innerHTML;
        const newHtml = currentHtml && currentHtml.length > 0 ? currentHtml + '<br>' + html : html;
        this._getNonFullscreenContentElement().innerHTML = `${newHtml}\n`;
        this._getFullscreenContentElement().innerHTML = `${newHtml}\n`;
    }

    setChild(childElement: HTMLElement) {
        this._childElement = childElement;

        if (document.fullscreenElement) {
            this._getFullscreenContentElement().appendChild(this._childElement);
        } else {
            this._getNonFullscreenContentElement().appendChild(this._childElement);
        }
    }

    remove() {
        if (this._nonFullscreenContentElement) {
            if (this._nonFullscreenElementFullscreenChangeListener) {
                document.removeEventListener('fullscreenchange', this._nonFullscreenElementFullscreenChangeListener);
            }

            if (this._nonFullscreenElementFullscreenPollingInterval) {
                clearInterval(this._nonFullscreenElementFullscreenPollingInterval);
                this._nonFullscreenElementFullscreenPollingInterval = undefined;
            }

            this._nonFullscreenContentElement.remove();
            this._nonFullscreenContainerElement?.remove();
            this._nonFullscreenContainerElement = undefined;
            this._nonFullscreenContentElement = undefined;
        }

        if (this._fullscreenContentElement) {
            if (this._fullscreenElementFullscreenChangeListener) {
                document.removeEventListener('fullscreenchange', this._fullscreenElementFullscreenChangeListener);
            }

            if (this._fullscreenElementFullscreenPollingInterval) {
                clearInterval(this._fullscreenElementFullscreenPollingInterval);
                this._nonFullscreenElementFullscreenPollingInterval = undefined;
            }

            this._fullscreenContentElement.remove();
            this._fullscreenContainerElement?.remove();
            this._fullscreenContainerElement = undefined;
            this._fullscreenContentElement = undefined;
        }
    }

    private _getNonFullscreenContentElement(): HTMLElement {
        if (this._nonFullscreenContentElement) {
            return this._nonFullscreenContentElement;
        }

        const content = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(content);

        if (this._nonFullscreenContainerClassName) {
            container.className = this._nonFullscreenContainerClassName;
        }

        if (this._nonFullscreenContentClassName) {
            content.className = this._nonFullscreenContentClassName;
        }

        this._onContainerElementCreated?.(container);
        document.body.appendChild(container);

        const toggle = () => {
            if (document.fullscreenElement) {
                container.style.display = 'none';
            } else {
                container.style.display = '';

                if (this._childElement && this._childElement.parentElement !== content) {
                    content.appendChild(this._childElement);
                }
            }
        };

        toggle();
        this._nonFullscreenElementFullscreenChangeListener = () => toggle();
        this._nonFullscreenElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this._nonFullscreenElementFullscreenChangeListener);
        this._nonFullscreenContentElement = content;
        this._nonFullscreenContainerElement = container;

        return this._nonFullscreenContentElement;
    }

    private _getFullscreenContentElement(): HTMLElement {
        if (this._fullscreenContentElement) {
            return this._fullscreenContentElement;
        }

        const content = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(content);

        if (this._fullscreenContainerClassName) {
            container.className = this._fullscreenContainerClassName;
        }

        if (this._fullscreenContentClassName) {
            content.className = this._fullscreenContentClassName;
        }

        this._onFullscreenContainerElementCreated?.(container);
        this._findFullscreenParentElement(container).appendChild(container);

        const toggle = () => {
            if (document.fullscreenElement) {
                if (container.style.display === 'none') {
                    container.style.display = '';
                    this._findFullscreenParentElement(container).appendChild(container);
                }

                if (this._childElement && this._childElement.parentElement !== content) {
                    content.appendChild(this._childElement);
                }
            } else {
                container.style.display = 'none';
            }
        };

        toggle();
        this._fullscreenElementFullscreenChangeListener = () => toggle();
        this._fullscreenElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this._fullscreenElementFullscreenChangeListener);
        this._fullscreenContentElement = content;
        this._fullscreenContainerElement = container;

        return this._fullscreenContentElement;
    }

    private _findFullscreenParentElement(container: HTMLElement): HTMLElement {
        const testNode = container.cloneNode(true) as HTMLElement;
        testNode.innerHTML = '&nbsp;'; // The node needs to take up some space to perform test clicks
        let current = this._targetElement.parentElement;

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
