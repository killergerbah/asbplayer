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
        const maxX = rect.width + rect.x;
        const maxY = rect.height + rect.y;

        for (let x = rect.x; x <= maxX; x += stepX) {
            for (let y = rect.y; y <= maxY; y += stepY) {
                const point = {
                    x: this._withNoise(x, stepX, 0, maxX),
                    y: this._withNoise(y, stepY, 0, maxY)
                };
                yield point;
            }
        }
    }

    _withNoise(center, radius, min, max) {
        return Math.min(max, Math.max(min, center + (Math.random() * radius * 2 - radius)));
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