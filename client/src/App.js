import { makeStyles } from '@material-ui/core/styles';
import React, { useCallback, useState, useMemo } from 'react';
import Container from '@material-ui/core/Container';
import Modal from '@material-ui/core/Modal';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import theme from './theme';
import Api from './Api.js';
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

const useModalStyles = makeStyles((theme) => ({
    container: {
        outline: 'none'
    },
    modal: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        outline: 'none'
    }
}));

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

        history.push('/view?' + parameters.join('&'));
    }, [history]);

    const handleOpenPath = useCallback((path) => {
        history.push('/browse/' + path)
    }, [history]);

    let { path } = useParams();

    return (
        <Switch>
            <Route exact path="/" render={() => (<Redirect to="/browse" />)} />
            <Route exact path="/browse">
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route exact path="/browse/:path+">
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route path="/view">
                <Player api={api} />
            </Route>
        </Switch>
    );
}

export default App;
