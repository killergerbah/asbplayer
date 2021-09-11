export default class ControlsContainer {

    constructor(video) {
        this.video = video;
        this.elements = [];
    }

    show() {
        for (const e of this.elements) {
            e.classList.remove('asbplayer-hide');
        }
    }

    hide() {
        this._garbageCollectElements();
        this._findElements();

        for (const e of this.elements) {
            e.classList.add('asbplayer-hide');
        }

        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(), 0);
        });
    }

    _garbageCollectElements() {
        this.elements = this.elements.filter(e => document.body.contains(e));
    }

    _findElements() {
        for (const p of this._samplePoints()) {
            for (const element of  this._path(document.elementFromPoint(p.x, p.y))) {
                if (element && !this._contains(this.elements, element)) {
                    this.elements.push(element);
                }
            }
        }
    }

    * _samplePoints() {
        const rect = this.video.getBoundingClientRect();
        const stepX = rect.width / 25;
        const stepY = rect.height / 25;

        for (let x = rect.x; x <= rect.width + rect.x; x += stepX) {
            for (let y = rect.y; y <= rect.height + rect.y; y += stepY) {
                yield {x: x, y: y};
            }
        }
    }

    * _path(element) {
        if (!element || element.contains(this.video)) {
            return;
        }

        let current = element;
        yield current;

        while (true) {
            const parent = current.parentElement;

            if (!parent || parent.contains(this.video)) {
                break;
            }

            current = parent;
            yield current;
        }
    }

    _contains(elements, element) {
        for (const e of elements) {
            if (e.isSameNode(element)) {
                return true;
            }
        }

        return false;
    }
}