import { makeStyles } from '@material-ui/core/styles';
import React, { useCallback, useState, useMemo } from 'react';
import theme from './theme';
import Api from './Api.js';
import Bar from './Bar.js';
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

    return (
        <Switch>
            <Route exact path="/" render={() => (<Redirect to="/browse" />)} />
            <Route exact path="/browse">
                <Bar />
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route exact path="/browse/:path+">
                <Bar />
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route path="/view">
                <Bar />
                <Player api={api} />
            </Route>
        </Switch>
    );
}

export default App;
