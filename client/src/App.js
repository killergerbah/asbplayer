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
    Switch,
    Link,
    useHistory
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
    const [playingMedia, setPlayingMedia] = useState(null);
    const history = useHistory();
    const handleOpenMedia = useCallback((media) => {
        console.log('media=' + media);
        setPlayingMedia(media);
        history.push('view');
    }, [history]);

    return (
        <Switch>
            <Route exact path="/">
                <Browser api={api} onOpenMedia={(media) => handleOpenMedia(media)} />
            </Route>
            <Route exact path="/view">
                {playingMedia === null ? null : (<Player api={api} media={playingMedia} />)}
            </Route>
        </Switch>
    );
}

export default App;
