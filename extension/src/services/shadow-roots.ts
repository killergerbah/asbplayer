export const shadowRootHosts: Element[] = [];

const nodes: Node[] = [];
const iterationLimit = 100;

const garbageCollect = () => {
    let i = 0;

    while (i < shadowRootHosts.length) {
        const host = shadowRootHosts[i];

        if (!document.contains(host) || !host.shadowRoot) {
            shadowRootHosts.splice(i, 1);
        } else {
            ++i;
        }
    }
};

export const incrementallyFindShadowRoots = () => {
    garbageCollect();

    if (nodes.length === 0) {
        if (shadowRootHosts.length > 0) {
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

        if (shadowRoot) {
            shadowRootHosts.push(node as Element);
        }

        for (const child of node.childNodes) {
            nodes.push(child);
        }
    }
};
