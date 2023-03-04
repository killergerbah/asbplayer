import { poll } from './util';

document.addEventListener('asbplayer-get-synced-data', async () => {
    let basename = '';

    await poll(() => {
        const titleNodes = document.querySelectorAll('div[class^="Header__TitleContainer"]');
        const segments: string[] = [];
        const nodes: Node[] = [];

        for (let i = 0; i < titleNodes.length; ++i) {
            nodes.push(titleNodes[i]);
        }

        while (nodes.length > 0) {
            const node = nodes.shift();

            if (node === undefined) {
                break;
            }

            if (node.childNodes.length === 0) {
                const textContent = node.textContent;

                if (textContent !== null) {
                    segments.push(textContent);
                }

                continue;
            }

            for (let i = 0; i < node.childNodes.length; ++i) {
                const childNode = node.childNodes[i];
                nodes.push(childNode);
            }
        }

        if (segments.length > 0) {
            basename = segments.join(' ');
            return true;
        }

        return false;
    });

    document.dispatchEvent(
        new CustomEvent('asbplayer-synced-data', {
            detail: {
                error: '',
                basename: basename,
                subtitles: [],
            },
        })
    );
});
