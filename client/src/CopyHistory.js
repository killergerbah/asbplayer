import { useCallback } from 'react';
import Popover from '@material-ui/core/Popover';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
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

            if (i === props.items.length - 1) {
                content.push((<ListItem ref={scrollToBottomRefCallback} key={item.timestamp}>{item.text}</ListItem>));
            } else {
                content.push((<ListItem key={item.timestamp}>{item.text}</ListItem>));
            }

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
