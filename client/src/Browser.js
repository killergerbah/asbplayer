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

function File(props) {
}

export default function Browser(props) {
    const [files, setFiles] = useState([]);
    const classes = useStyles();

    var fetchFiles = (path) => {
         props.api.list(path)
             .then(res => setFiles(res.files))
             .catch(console.error);
    };

    var fetchRootFiles = () => {
         fetchFiles('');
    };

    useEffect(fetchRootFiles, []);

    if (files === null) {
        return null;
    }

    var handleFileLink = (file) => {
        switch (file.type) {
            case "audio":
                props.onOpenAudio(file);
                break;
            case "subtitle":
                props.onOpenSubtitle(file);
                break;
            case "directory":
                fetchFiles(file.path);
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
                        {files.map(f => {
                            return (
                                <TableRow key = {f.name}>
                                    <TableCell>
                                        <Link href="#" onClick={() => handleFileLink(f)}>{f.name}</Link>
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