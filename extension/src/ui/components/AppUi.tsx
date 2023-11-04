import { BrowserRouter } from 'react-router-dom';
import { RootApp } from '@project/common/app';
import Bridge from '../bridge';
import { useMemo } from 'react';
import { BridgeSettingsStorage } from '../bridge-settings-storage';
import { BridgeFetcher } from '../bridge-fetcher';
import { Rnd } from 'react-rnd';

interface Props {
    bridge: Bridge;
    logoUrl: string;
}
export const AppUi = ({ bridge, logoUrl }: Props) => {
    const settingsStorage = useMemo(() => new BridgeSettingsStorage(bridge), [bridge]);
    const fetcher = useMemo(() => new BridgeFetcher(bridge), [bridge]);
    // TODO: Adjust dimensions, clean up dragging/resizing UX
    // TODO: Deal with 'origin' property and video file loading
    return (
        <Rnd
            default={{
                x: 0,
                y: 0,
                width: 320,
                height: 200,
            }}
        >
            <BrowserRouter>
                <RootApp origin={'about:blank'} logoUrl={logoUrl} settingsStorage={settingsStorage} fetcher={fetcher} />
            </BrowserRouter>
        </Rnd>
    );
};
