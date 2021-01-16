# asbplayer

Browser-based subtitles/audio player intended as a language-learning tool. 
The application is written using React, with a Java-based server as a backend.

## Suggested use cases

### Active immersion
1. Stream target language media with no subtitles e.g. on Netflix.
2. Play the subtitles in a separate browser tab using this application.
3. If a word you don't know comes up, quickly switch to the application and use a popup
dictionary to look up the word. 
4. Use the 'copy' button to copy the sentence for mining if desired.
5. Works better if there are two monitors, one with the stream and the other with the subtitles.

### Passive immersion

1. Play audio/subtitles using the application and listen passively.
2. If something you can't understand comes up, quickly refer to the transcription.
3. Works well with a tool like [subs2cia](https://github.com/dxing97/subs2cia) which creates condensed audio
along with condensed subtitles that can be played using this application.

## Running the application

1. Ensure Java 11 is installed on your machine.
2. Clone the repo.
3. Run the server. In the command, replace `E:\condensed-audio` with the absolute path to the directory containing the
 audio/subtitles you want to play.
    ```
    # Windows
    mvnw spring-boot:run -Dspring-boot.run.arguments="--root=E:\condensed-audio"
    
    # Mac/Linux
    ./mvnw spring-boot:run -Dspring-boot.run.arguments="--root=E:\condensed-audio"
    ```
4. Access the application at `http://localhost:8080`
5. Find a subtitle file to play in the browser. If there is an audio file with the same name as the subtitle file then
it will be used as the audio stream.

![Player preview](https://i.imgur.com/AB6ItO9.gif)


