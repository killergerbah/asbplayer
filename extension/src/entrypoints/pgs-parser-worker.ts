import { onMessage } from '@project/common/subtitle-reader/pgs-parser-worker';

export default defineUnlistedScript(() => {
    onMessage();
});
