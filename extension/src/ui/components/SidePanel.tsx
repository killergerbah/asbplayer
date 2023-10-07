import CssBaseline from "@material-ui/core/CssBaseline"
import { ThemeProvider } from "@material-ui/core/styles"
import { createTheme } from "@project/common"

export default function SidePanel() {
    const theme = createTheme('dark');
    return (
        <ThemeProvider theme={theme}>
        <CssBaseline />
        </ThemeProvider>
    )
}