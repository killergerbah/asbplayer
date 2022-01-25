const fs = require('fs');
const path = require('path');
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

// create-react-app scripts don't work with typescript projects linked by yarn out-of-the-box
// https://stackoverflow.com/questions/65893787/create-react-app-with-typescript-and-npm-link-enums-causing-module-parse-failed
module.exports = {
    webpack: {
        configure: (webpackConfig) => ({
            ...webpackConfig,
            module: {
                ...webpackConfig.module,
                rules: webpackConfig.module.rules.map((rule) => {
                    if (!rule.oneOf) return rule;
                    return {
                        ...rule,
                        oneOf: rule.oneOf.map((ruleObject) => {
                            if (!new RegExp(ruleObject.test).test('.ts') || !ruleObject.include) return ruleObject;
                            return {
                                ...ruleObject,
                                include: [resolveApp('src'), resolveApp('../common')],
                            };
                        }),
                    };
                }),
            },
        }),
    },
};
