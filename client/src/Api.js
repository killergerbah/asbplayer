export default function Api() {
    this.baseUrl = "http://localhost:8080";

    function encode(path) {
        return path.replaceAll('/', '\\').split('\\').map((part) => encodeURIComponent(part)).join('/');
    };

    this.list = function(path) {
        return fetch(this.baseUrl + "/ls/" + encode(path))
            .then(response => response.json())
    };

    this.subtitles = function(path) {
        return fetch(this.baseUrl + "/subtitle/" + encode(path))
            .then(response => response.json())
    };

    this.streamingUrl = function(path) {
        return this.baseUrl + "/stream/" + encode(path);
    };
}