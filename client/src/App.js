import { makeStyles } from '@material-ui/core/styles';
import React, { useCallback, useState, useMemo } from 'react';
import theme from './theme';
import Api from './Api.js';
import Bar from './Bar.js';
import CopyHistory from './CopyHistory.js';
import Browser from './Browser.js';
import Player from './Player.js';
import {
    Route,
    Redirect,
    Switch,
    Link,
    useHistory,
    useParams
} from "react-router-dom";

function App() {
    const api = useMemo(() => new Api(), []);
    const history = useHistory();
    const [copiedSubtitles, setCopiedSubtitles] = useState([]);
    const [copyHistoryOpen, setCopyHistoryOpen] = useState(false);
    const [copyHistoryAnchorEl, setCopyHistoryAnchorEl] = useState(null);

    const handleOpenMedia = useCallback((media) => {
        var parameters = [];

        if (media.audioFile) {
            parameters.push('audio=' + encodeURIComponent(media.audioFile.path));
        }

        if (media.subtitleFile) {
            parameters.push('subtitle=' + encodeURIComponent(media.subtitleFile.path));
        }

        parameters.push('name=' + encodeURIComponent(media.name));

        history.push('/view?' + parameters.join('&'));
    }, [history]);

    const handleOpenPath = useCallback((path) => {
        history.push('/browse/' + path);
    }, [history]);

    const handleCopy = useCallback((text, fileName) => {
        copiedSubtitles.push({
            timestamp: new Date().getTime(),
            text: text,
            name: fileName
        });
        setCopiedSubtitles(copiedSubtitles);
    }, [setCopiedSubtitles, copiedSubtitles]);

    const handleOpenCopyHistory = useCallback((event) => {
        setCopyHistoryOpen(!copyHistoryOpen);
        setCopyHistoryAnchorEl(event.currentTarget);
    }, [setCopyHistoryOpen, copyHistoryOpen, setCopyHistoryAnchorEl]);

    const handleCloseCopyHistory = useCallback(() => {
        setCopyHistoryOpen(false);
        setCopyHistoryAnchorEl(null);
    }, [setCopyHistoryOpen, setCopyHistoryAnchorEl]);

    return (
        <div>
        <CopyHistory items={copiedSubtitles} open={copyHistoryOpen} anchorEl={copyHistoryAnchorEl} onClose={handleCloseCopyHistory} />
        <Switch>
            <Route exact path="/" render={() => (<Redirect to="/browse" />)} />
            <Route exact path="/browse">
                <Bar onOpenCopyHistory={handleOpenCopyHistory} />
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route exact path="/browse/:path+">
                <Bar onOpenCopyHistory={handleOpenCopyHistory} />
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route path="/view">
                <Bar onOpenCopyHistory={handleOpenCopyHistory} />
                <Player api={api} onCopy={handleCopy} />
            </Route>
        </Switch>
        </div>
    );
}

export default App;
