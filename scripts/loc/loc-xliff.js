import { createjs, js2xliff } from 'xliff';
import { writeFile, access, mkdir } from 'fs/promises';
import {
    supportedLocales,
    flattenedLocJsonByNamespace,
    readFlattenedUntranslatedKeysByNamespace,
    flattenedNotesJsonByNamespace,
} from './locales.js';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

async function xliffJsonByNamespace(locale) {
    const source = await flattenedLocJsonByNamespace('en');
    const target = await flattenedLocJsonByNamespace(locale);
    const untranslated = await readFlattenedUntranslatedKeysByNamespace(locale);
    const notes = await flattenedNotesJsonByNamespace();

    for (const namespace of Object.keys(untranslated)) {
        for (const key of Object.keys(untranslated[namespace])) {
            delete target[namespace][key];
        }
    }

    const xliffJsonByNamespace = {};

    for (const namespace of Object.keys(source)) {
        const xliffJson = await createjs(
            'en',
            locale,
            source[namespace],
            target[namespace],
            namespace,
            undefined,
            notes[namespace]
        );
        xliffJsonByNamespace[namespace] = xliffJson;
    }

    return xliffJsonByNamespace;
}

async function ensureDirectory(path) {
    try {
        await access(path);
    } catch (e) {
        await mkdir(path);
    }
}

async function toXliff(json) {
    const options = { ignoreAttributes: false, attributeNamePrefix: '@_', format: true };
    const xliff = await js2xliff(json);
    const parser = new XMLParser(options);
    const modified = parser.parse(xliff);

    for (const note of modified.xliff.file.unit) {
        note.segment['@_state'] = note.segment.target ? 'final' : 'initial';
    }
    const builder = new XMLBuilder(options);
    return builder.build(modified);
}

(async function main() {
    await ensureDirectory('xliff');
    const locales = await supportedLocales();
    for (const locale of locales) {
        await ensureDirectory(`xliff/${locale}`);
        const json = await xliffJsonByNamespace(locale);
        for (const namespace of Object.keys(json)) {
            await writeFile(`xliff/${locale}/${namespace}.xliff`, await toXliff(json[namespace]));
        }
    }
})();
