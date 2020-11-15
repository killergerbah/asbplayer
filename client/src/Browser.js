import React, {useState, useEffect} from 'react';

export default function Browser(props) {
    const [files, setFiles] = useState(null);
//    const [cwd, setCwd] = useState('/');

    var fetchFiles = () => {
         props.api.list()
             .then(setFiles)
             .catch(error => console.error(error));
    };

    useEffect(fetchFiles, []);

    if (files === null) {
        return null;
    }

    return (
        <div>
            {
                files.map(f => {
                    return (<div key={f}>{f}</div>);
                })
            }
        </div>
    );
}