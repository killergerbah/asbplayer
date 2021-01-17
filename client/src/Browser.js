import React, { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import FolderIcon from '@material-ui/icons/Folder';
import Link from '@material-ui/core/Link';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

const useStyles = makeStyles({
    root: {
        width: '100%',
        height: 'calc(100vh - 64px)',
        position: 'relative',
        overflowX: 'hidden'
    }
});

function ItemTypeIcons(props) {
    const item = props.item;

    if (item.type === "directory") {
        return <div><FolderIcon /></div>
    }

    return (
        <div>
            {item.audioFile ? <AudiotrackIcon /> : null}
            {item.subtitleFile ? <SubtitlesIcon /> : null}
        </div>
    );
}

export default function Browser(props) {
    const [items, setItems] = useState([]);
    const classes = useStyles();
    const { path } = useParams();

    var fetchRootItems = useCallback(() => {
         props.api.list(path || '')
             .then(res => setItems(res.items))
             .catch(console.error);
    }, [path, props.api]);

    useEffect(fetchRootItems, [fetchRootItems]);

    if (items === null) {
        return null;
    }

    var handleItem = (item) => {
        switch (item.type) {
            case "media":
                props.onOpenMedia(item);
                break;
            case "directory":
                props.onOpenDirectory(item.path);
                break;
            default:
                console.error("Unsupported item type " + item.type);
        }
    };

    return (
        <div className={classes.root}>
            <TableContainer>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map(i => {
                            return (
                                <TableRow key={i.name}>
                                    <TableCell>
                                        <Link component="button" variant="body2" onClick={() => handleItem(i)}>{i.name}</Link>
                                    </TableCell>
                                    <TableCell>
                                        <ItemTypeIcons item={i} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}