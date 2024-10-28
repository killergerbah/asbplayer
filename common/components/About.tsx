import React from 'react';
import Box from '@material-ui/core/Box';
import MuiLink, { LinkProps } from '@material-ui/core/Link';
import LogoIcon from './LogoIcon';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableHead from '@material-ui/core/TableHead';
import MuiTableRow from '@material-ui/core/TableRow';
import MuiTableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import Typography from '@material-ui/core/Typography';
import { useTheme, withStyles, Theme } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';

interface Props {
    appVersion?: string;
    extensionVersion?: string;
}

const Link = ({ children, ...props }: { children: React.ReactNode } & LinkProps) => {
    return (
        <MuiLink target="_blank" color="textPrimary" underline="always" {...props}>
            {children}
        </MuiLink>
    );
};

const TableCell = withStyles((theme) => ({
    head: {
        backgroundColor: theme.palette.background.default,
        // backgroundColor: theme.palette.common.black,
        // color: theme.palette.common.white,
    },
    root: {
        border: 0,
    },
    body: {
        fontSize: 14,
    },
}))(MuiTableCell);

const EvenTableRow = MuiTableRow;

const OddTableRow = withStyles((theme) => ({
    root: {
        backgroundColor: theme.palette.action.hover,
    },
}))(MuiTableRow);

type Dependency = {
    name: string;
    projectLink?: string;
    license: string;
    licenseLink: string;
    purpose: string;
    extension?: boolean;
};

const dependencies: Dependency[] = [
    {
        name: 'react',
        license: 'MIT',
        licenseLink: 'https://github.com/facebook/react/blob/v18.0.0/LICENSE',
        purpose: 'UI',
    },
    {
        name: 'Material UI',
        license: 'MIT',
        licenseLink: 'https://github.com/mui/material-ui/blob/v4.x/LICENSE',
        purpose: 'UI',
    },
    {
        name: 'Roboto',
        license: 'Apache 2.0',
        licenseLink: 'https://fonts.google.com/specimen/Roboto/license',
        purpose: 'UI',
    },
    {
        name: 'Dexie.js',
        license: 'Apache 2.0',
        licenseLink: 'https://github.com/dexie/Dexie.js/blob/master/LICENSE',
        purpose: 'Persistence',
    },
    {
        name: 'flatten-interval-tree',
        license: 'MIT',
        licenseLink: 'https://github.com/alexbol99/flatten-interval-tree/blob/master/LICENSE',
        purpose: 'Subtitle rendering',
    },
    {
        name: 'srt-parser',
        license: 'MIT',
        licenseLink: 'https://github.com/qgustavor/srt-parser/blob/master/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'ass-compiler',
        license: 'MIT',
        licenseLink: 'https://github.com/weizhenye/ass-compiler/blob/master/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'pgs-parser',
        license: 'MIT',
        licenseLink: 'https://github.com/killergerbah/pgs-parser/blob/main/LICENSE.md',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'fast-xml-parser',
        license: 'MIT',
        licenseLink: 'https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'vtt.js',
        license: 'Apache-2.0',
        licenseLink: 'https://github.com/mozilla/vtt.js/blob/master/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'semver',
        license: 'ISC',
        licenseLink: 'https://github.com/npm/node-semver/blob/main/LICENSE',
        purpose: 'Version string parsing',
    },

    {
        name: 'hotkeys-js',
        license: 'MIT',
        licenseLink: 'https://github.com/jaywcjlove/hotkeys-js/blob/master/LICENSE',
        purpose: 'Keyboard shortcuts',
    },
    {
        name: 'i18next',
        license: 'MIT',
        licenseLink: 'https://github.com/i18next/i18next/blob/master/LICENSE',
        purpose: 'Localization',
    },
    {
        name: 'lamejs',
        projectLink: 'https://lame.sourceforge.io',
        license: 'LGPL',
        licenseLink: 'https://github.com/zhuker/lamejs/blob/master/LICENSE',
        purpose: 'MP3 encoding',
    },
    {
        name: 'sanitize-filename',
        license: 'ISC+WTFPL',
        licenseLink: 'https://github.com/parshap/node-sanitize-filename/blob/master/LICENSE.md',
        purpose: 'Filename sanitization',
    },
    {
        name: 'uuidjs',
        license: 'MIT',
        licenseLink: 'https://github.com/uuidjs/uuid/blob/main/LICENSE.md',
        purpose: 'UUID generation',
    },
    {
        name: 'url',
        license: 'MIT',
        licenseLink: 'https://github.com/defunctzombie/node-url/blob/master/LICENSE',
        purpose: 'Polyfill',
    },
    {
        name: 'm3u8-parser',
        license: 'Apache-2.0',
        licenseLink: 'https://github.com/videojs/m3u8-parser/blob/main/LICENSE',
        purpose: 'Subtitle detection',
        extension: true,
    },
    {
        name: 'mpd-parser',
        license: 'Apache-2.0',
        licenseLink: 'https://github.com/videojs/mpd-parser/blob/main/LICENSE',
        purpose: 'Subtitle detection',
        extension: true,
    },
];

const dependencyPurposeCounts: { [key: string]: number } = {};

for (const dep of dependencies) {
    let count = dependencyPurposeCounts[dep.purpose] ?? 0;
    dependencyPurposeCounts[dep.purpose] = count + 1;
}

const About = ({ appVersion, extensionVersion }: Props) => {
    const theme = useTheme<Theme>();
    const { t } = useTranslation();
    const renderedPurpose: { [key: string]: boolean } = {};
    let purposeIndex = 0;
    return (
        <Box p={1} style={{ width: '100%' }}>
            <Box style={{ width: '100%', textAlign: 'center' }}>
                <LogoIcon style={{ width: 48, height: 48 }} />
                <br />
                <Link variant="h5" href="https://github.com/killergerbah/asbplayer">
                    asbplayer
                </Link>
                <br />
                {appVersion && (
                    <>
                        <Typography variant="caption">
                            {t('about.appVersion')}{' '}
                            <Link href={`https://github.com/killergerbah/asbplayer/commit/${appVersion}`}>
                                {appVersion}
                            </Link>
                        </Typography>
                        <br />
                    </>
                )}
                {extensionVersion && (
                    <Typography variant="caption">
                        {t('about.extensionVersion')}{' '}
                        <Link href={`https://github.com/killergerbah/asbplayer/releases/tag/v${extensionVersion}`}>
                            {extensionVersion}
                        </Link>
                    </Typography>
                )}
            </Box>
            <p />
            <Typography variant="h5">{t('about.license')}</Typography>
            <p />
            <Paper variant="outlined" style={{ padding: theme.spacing(2), height: 'auto' }}>
                <Typography variant="body2">
                    MIT License
                    <p />
                    Copyright (c) 2020 R-J Lim
                    <p />
                    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
                    associated documentation files (the &quot;Software&quot;), to deal in the Software without
                    restriction, including without limitation the rights to use, copy, modify, merge, publish,
                    distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
                    Software is furnished to do so, subject to the following conditions:
                    <p />
                    The above copyright notice and this permission notice shall be included in all copies or substantial
                    portions of the Software.
                    <p />
                    THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
                    INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
                    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
                    OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
                    CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
                </Typography>
            </Paper>
            <br />
            <br />
            <Typography variant="h5">{t('about.deps')}</Typography>
            <p />
            <TableContainer variant="outlined" component={Paper} style={{ height: 'auto' }}>
                <Table style={{ margin: 0, padding: 0 }}>
                    <TableHead>
                        <EvenTableRow>
                            <TableCell>{t('about.depName')}</TableCell>
                            <TableCell>{t('about.license')}</TableCell>
                            <TableCell>{t('about.purpose')}</TableCell>
                        </EvenTableRow>
                    </TableHead>
                    <TableBody>
                        {dependencies
                            .filter((d) => !d.extension || extensionVersion !== undefined)
                            .map((d) => {
                                let alreadyRenderedPurpose: boolean;

                                if (renderedPurpose[d.purpose] === undefined) {
                                    alreadyRenderedPurpose = false;
                                    purposeIndex++;
                                } else {
                                    alreadyRenderedPurpose = true;
                                }

                                renderedPurpose[d.purpose] = true;
                                const RowComponent = purposeIndex % 2 === 0 ? EvenTableRow : OddTableRow;
                                return (
                                    <RowComponent key={d.name}>
                                        <TableCell>
                                            {d.projectLink && <Link href={d.projectLink}>{d.name}</Link>}
                                            {!d.projectLink && d.name}
                                        </TableCell>
                                        <TableCell>
                                            <Link href={d.licenseLink}>{d.license}</Link>
                                        </TableCell>
                                        {!alreadyRenderedPurpose && (
                                            <TableCell rowSpan={dependencyPurposeCounts[d.purpose]}>
                                                {d.purpose}
                                            </TableCell>
                                        )}
                                    </RowComponent>
                                );
                            })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default About;
