import { targetOfjs, xliff2js } from 'xliff';
import { readFile } from 'fs/promises';
import { supportedLocales, flattenedLocJsonByNamespace, updateWithFlattenedLocJsonByNamespace } from './locales.js';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

async function toJson(path) {
    const options = { ignoreAttributes: false, attributeNamePrefix: '@_', format: true };
    let xml = await readFile(path, 'utf-8');
    const parser = new XMLParser(options);
    const xliff = parser.parse(xml);

    for (const note of xliff.xliff.file.unit) {
        if (note.segment['@_state'] !== 'final') {
            delete note.segment.target;
        }
    }

    const builder = new XMLBuilder(options);
    xml = builder.build(xliff);
    return targetOfjs(await xliff2js(xml));
}

(async function main() {
    const locales = await supportedLocales();
    const locJson = {};

    for (const locale of locales) {
        if (locale === 'en') {
            continue;
        }

        const namespaces = Object.keys(await flattenedLocJsonByNamespace(locale));

        for (const namespace of namespaces) {
            locJson[namespace] = await toJson(`xliff/${locale}/${namespace}.xliff`, 'utf-8');
        }

        await updateWithFlattenedLocJsonByNamespace(locale, locJson);
    }
})();
