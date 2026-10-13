import { JitenClient } from '@project/common/jiten/jiten';
import type { SettingsProvider } from '@project/common/settings';
import { i18nInit } from '@project/extension/src/services/i18n';

let client: JitenClient | undefined;
let account: string | undefined;

export async function getJitenClient(settings: SettingsProvider) {
    await i18nInit(await settings.getSingle('language'));
    const apiKey = await settings.getSingle('jitenApiKey');
    const activeProfile = await settings.activeProfile();
    const currentAccount = JSON.stringify([apiKey, activeProfile?.name]);
    if (currentAccount !== account) {
        client = new JitenClient(apiKey);
        account = currentAccount;
    }
    return client!;
}
