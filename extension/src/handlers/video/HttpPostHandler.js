export default class HttpPostHandler {

    constructor() {
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'http-post';
    }

    handle(request, sender, sendResponse) {
        fetch(request.message.url, {
            method: 'POST',
            body: JSON.stringify(request.message.body)
        })
        .then((response) => response.json())
        .then((json) => sendResponse(json))
        .catch((e) => sendResponse({error: e.message}))

        return true;
    }
}