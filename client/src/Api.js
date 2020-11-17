export default function Api() {
    this.baseUrl = "http://localhost:8080";

    this.list = function(path) {
        return fetch(this.baseUrl + "/ls/" + encodeURI(path))
            .then(response => response.json())
    };

    this.subtitles = function(path) {
        return fetch(this.baseUrl + "/subtitle/" + encodeURI(path))
            .then(response => response.json())
    };

    this.streamingUrl = function(path) {
        return this.baseUrl + "/stream/" + encodeURI(path);
    };
}