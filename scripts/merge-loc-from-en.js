const path = require('path');
const fs = require('fs');
const localesPath = path.join(__dirname, '../common/locales');

const merge = (a, b) => {
    const merged = { ...a, ...b };

    for (const key of Object.keys(a)) {
        if (typeof a[key] !== 'object') {
            continue;
        }

        if (key in b) {
            merged[key] = merge(a[key], b[key]);
        }
    }

    return merged;
};

fs.readdir(localesPath, (err, files) => {
    if (err) {
        console.error(error);
    }

    const enLocale = JSON.parse(fs.readFileSync(`${localesPath}/en.json`));

    for (const f of files) {
        if (f === 'en.json') {
            continue;
        }

        const localePath = `${localesPath}/${f}`;
        const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        const mergedLocale = merge(enLocale, locale);
        fs.writeFileSync(localePath, JSON.stringify(mergedLocale, null, 4), 'utf8');
    }
});
