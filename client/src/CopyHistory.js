import { useCallback } from 'react';
import Popover from '@material-ui/core/Popover';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListSubheader from '@material-ui/core/ListSubheader';

export default function CopyHistory(props) {
    const scrollToBottomRefCallback =  useCallback(element => {
        if (element) {
            element.scrollIntoView();
        }
    }, []);

    let content = null;

    if (props.items.length > 0) {
        content = [];
        let lastSeenItemName = null;
        let i = 0;

        for (const item of props.items) {
            if (lastSeenItemName === null || lastSeenItemName !== item.name) {
                lastSeenItemName = item.name;
                content.push((<ListSubheader disableSticky={true} key={item.name}>{item.name}</ListSubheader>));
            }

            const ref = i === props.items.length - 1 ? scrollToBottomRefCallback : null;

            content.push((
                <ListItem ref={ref} key={item.timestamp}>
                    <ListItemIcon>
                        <IconButton onClick={(e) => navigator.clipboard.writeText(item.text)}>
                            <FileCopyIcon />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemIcon>
                        <IconButton disabled={!item.audioFile} onClick={() => props.onClipAudio(item)}>
                            <AudiotrackIcon />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemIcon>
                        <IconButton onClick={() => props.onDelete(item)}>
                            <DeleteIcon />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemText>{item.text}</ListItemText>
                </ListItem>
            ));

            ++i;
        }

    } else {
        content = (<ListItem>Copy history is empty.</ListItem>);
    }

    const list = (<List>{content}</List>);

    return (
        <Popover
            disableEnforceFocus={true}
            open={props.open}
            anchorEl={props.anchorEl}
            onClose={props.onClose}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'center',
            }}>
            {list}
        </Popover>
    );
}
