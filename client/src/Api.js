export default function Api() {
    this.baseUrl = "http://localhost:8080";
    this.list = function() {
        return fetch(this.baseUrl + "/api/ls")
            .then(response => response.json())
    };
}