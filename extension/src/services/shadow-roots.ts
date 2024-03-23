export const shadowRoots: ShadowRoot[] = [];

const nodes: Node[] = [];
const iterationLimit = 100;
let found = false;

export const incrementallyFindShadowRoots = () => {
    if (nodes.length === 0) {
        if (found) {
            return;
        }

        nodes.push(document);
    }

    let iteration = 0;

    while (nodes.length > 0 && ++iteration < iterationLimit) {
        const node = nodes.pop();

        if (!node) {
            continue;
        }

        const shadowRoot = (node as Element).shadowRoot;

        if (shadowRoot && !shadowRoots.includes(shadowRoot)) {
            shadowRoots.push(shadowRoot);
            found = true;
        }

        for (const child of node.childNodes) {
            nodes.push(child);
        }
    }
};
