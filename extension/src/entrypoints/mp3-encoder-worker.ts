import { onMessage } from '@project/common/audio-clip/mp3-encoder-worker';

export default defineUnlistedScript(() => {
    onMessage();
});
