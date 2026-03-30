import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#9c2f00"
    },
    secondary: {
      main: "#1c6e5b"
    },
    background: {
      default: "#f7f2ea",
      paper: "#fffaf3"
    }
  },
  shape: {
    borderRadius: 16
  },
  typography: {
    fontFamily: "\"Trebuchet MS\", \"Segoe UI\", sans-serif",
    h1: {
      fontWeight: 800
    },
    h2: {
      fontWeight: 800
    },
    h3: {
      fontWeight: 700
    }
  }
});
