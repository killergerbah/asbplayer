import { pageMetadata } from '.';

it('page csp rule ids are distinct', () => {
    const seenRuleIds: { [ruleId: number]: boolean } = {};
    for (const metadata of Object.values(pageMetadata)) {
        expect(!(metadata.disableCspRuleId in seenRuleIds));
        seenRuleIds[metadata.disableCspRuleId] = true;
    }
});
