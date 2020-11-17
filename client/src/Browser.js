import React, {useState, useEffect} from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Link from '@material-ui/core/Link';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

const useStyles = makeStyles({
  root: {
    width: '100%',
  },
  container: {
    maxHeight: '100vh',
  },
});

export default function Browser(props) {
    const [items, setItems] = useState([]);
    const classes = useStyles();

    var fetchItems = (path) => {
         props.api.list(path)
             .then(res => setItems(res.items))
             .catch(console.error);
    };

    var fetchRootItems = () => {
         fetchItems('');
    };

    useEffect(fetchRootItems, []);

    if (items === null) {
        return null;
    }

    var handleItem = (item) => {
        switch (item.type) {
            case "media":
                props.onOpenMedia(item);
                break;
            case "directory":
                fetchItems(item.path);
                break;
        }
    };

    return (
        <Paper square className={classes.root}>
            <TableContainer className={classes.container}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map(i => {
                            return (
                                <TableRow key = {i.name}>
                                    <TableCell>
                                        <Link href="#" onClick={() => handleItem(i)}>{i.name}</Link>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}