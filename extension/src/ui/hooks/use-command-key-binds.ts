import { chromeCommandBindsToKeyBinds } from '@project/common/settings';
import { useEffect, useState } from 'react';

export const useCommandKeyBinds = () => {
    const [commands, setCommands] = useState<{ [key: string]: string | undefined }>();
    useEffect(() => {
        if (chrome.commands === undefined) {
            setCommands({});
            return;
        }

        chrome.commands.getAll().then((commands) => {
            const commandsObj: any = {};

            for (const c of commands) {
                if (c.name && c.shortcut) {
                    commandsObj[c.name] = c.shortcut;
                }
            }

            setCommands(chromeCommandBindsToKeyBinds(commandsObj));
        });
    });
    return commands;
};
