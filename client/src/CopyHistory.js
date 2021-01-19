import Popover from '@material-ui/core/Popover';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListSubheader from '@material-ui/core/ListSubheader';

export default function CopyHistory(props) {
    let content = null;

    if (props.items.length > 0) {
        content = [];
        let lastSeenItemName = null;
        for (const item of props.items) {
            if (lastSeenItemName === null || lastSeenItemName !== item.name) {
                lastSeenItemName = item.name;
                content.push((<ListSubheader disableSticky={true} key={item.name}>{item.name}</ListSubheader>));
            }
            content.push((<ListItem key={item.timestamp}>{item.text}</ListItem>));
        }
    } else {
        content = (<ListItem>Copy history is empty.</ListItem>);
    }

    const list = (<List>{content}</List>);

    return (
        <Popover
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
