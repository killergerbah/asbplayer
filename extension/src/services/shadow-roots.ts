export const shadowRoots: ShadowRoot[] = [];

const nodes: Node[] = [];
const iterationLimit = 100;

export const incrementallyFindShadowRoots = () => {
    if (nodes.length === 0) {
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
        }

        for (const child of node.childNodes) {
            nodes.push(child);
        }
    }
};
