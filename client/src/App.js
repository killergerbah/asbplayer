import { makeStyles } from '@material-ui/core/styles';
import React, {useState,} from 'react';
import Container from '@material-ui/core/Container';
import Modal from '@material-ui/core/Modal';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import theme from './theme';
import Api from './Api.js';
import Browser from './Browser.js';
import Player from './Player.js';

const api = new Api();

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

function PlayerModal(props) {
    const classes = useModalStyles();
    const player = (<Player api={props.api} media={props.media} />);

    return (
        <Modal className={classes.modal} open={props.open} onClose={props.onClose}>
            <Container className={classes.container}>{player}</Container>
        </Modal>
    );
}

function App() {
    const [playingMedia, setPlayingMedia] = useState(null);
    const [playerOpen, setPlayerOpen] = useState(false);

    const handleOpenMedia = (media) => {
        setPlayingMedia(media);
        setPlayerOpen(true);
    };

    const handlePlayerClose = () => {
        setPlayerOpen(false);
    };

    return (
        <Container>
            <Browser api={api} onOpenMedia={handleOpenMedia}/>
            {playingMedia === null ? null : <PlayerModal open={playerOpen} onClose={handlePlayerClose} api={api} media={playingMedia} />}
        </Container>
  );
}

export default App;
