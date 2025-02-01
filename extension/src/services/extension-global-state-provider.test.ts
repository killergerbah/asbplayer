import { ExtensionGlobalStateProvider } from './extension-global-state-provider';
import { MockStorageArea } from './mock-storage-area';

it('can retrieve list of keys', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    expect(await provider.get(['ftueHasSeenAnkiDialogQuickSelect'])).toEqual({
        ftueHasSeenAnkiDialogQuickSelect: false,
    });
    await provider.set({ ftueHasSeenAnkiDialogQuickSelect: true });
    expect(await provider.get(['ftueHasSeenAnkiDialogQuickSelect'])).toEqual({
        ftueHasSeenAnkiDialogQuickSelect: true,
    });
});

it('can retrieve 0 keys', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    expect(await provider.get([])).toEqual({});
});

it('can retrieve all keys', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    expect(await provider.getAll()).toEqual({ ftueHasSeenAnkiDialogQuickSelect: false });
});
