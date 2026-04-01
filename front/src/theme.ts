import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#f48a1f",
      light: "#ffad4d",
      dark: "#c86205"
    },
    secondary: {
      main: "#16a87b",
      light: "#34d7a4",
      dark: "#0c7a59"
    },
    error: {
      main: "#ff5f6d"
    },
    warning: {
      main: "#ffb547"
    },
    success: {
      main: "#32d399"
    },
    background: {
      default: "#070d1c",
      paper: "#10182a"
    },
    text: {
      primary: "#f6f3ef",
      secondary: "#98a5c3"
    },
    divider: "rgba(158, 176, 214, 0.16)"
  },
  shape: {
    borderRadius: 6
  },
  typography: {
    fontFamily: "\"Avenir Next\", \"Trebuchet MS\", \"Verdana\", sans-serif",
    h1: {
      fontWeight: 800
    },
    h2: {
      fontWeight: 800
    },
    h3: {
      fontWeight: 800
    },
    h4: {
      fontWeight: 700
    },
    h5: {
      fontWeight: 700
    },
    button: {
      fontWeight: 800,
      letterSpacing: "0.02em",
      textTransform: "none"
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": {
          minHeight: "100%"
        },
        body: {
          background:
            "radial-gradient(circle at top left, rgba(244,138,31,0.14), transparent 26%), radial-gradient(circle at top right, rgba(28,41,82,0.72), transparent 42%), linear-gradient(180deg, #0a1020 0%, #070d1c 100%)",
          color: "#f6f3ef"
        },
        "*": {
          boxSizing: "border-box"
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: "linear-gradient(180deg, rgba(16,24,42,0.96) 0%, rgba(12,19,35,0.96) 100%)",
          border: "1px solid rgba(158, 176, 214, 0.14)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.34)",
          backdropFilter: "blur(18px)"
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 50,
          borderRadius: 999,
          paddingInline: 22,
          "&.Mui-disabled": {
            color: "rgba(233, 238, 250, 0.38)",
            background: "rgba(90, 101, 126, 0.28)",
            borderColor: "rgba(90, 101, 126, 0.18)",
            boxShadow: "none"
          }
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #f5a623 0%, #df5b00 100%)",
          boxShadow: "0 14px 30px rgba(223, 91, 0, 0.28)"
        },
        containedSecondary: {
          background: "linear-gradient(135deg, #109f79 0%, #0b7d67 100%)",
          boxShadow: "0 14px 30px rgba(11, 125, 103, 0.28)"
        },
        outlined: {
          borderColor: "rgba(126, 148, 190, 0.28)"
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          backgroundColor: "rgba(16, 24, 42, 0.84)",
          "& fieldset": {
            borderColor: "rgba(126, 148, 190, 0.2)"
          },
          "&:hover fieldset": {
            borderColor: "rgba(174, 194, 232, 0.38)"
          },
          "&.Mui-focused fieldset": {
            borderWidth: 1,
            borderColor: "#f48a1f"
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: "1px solid rgba(158, 176, 214, 0.16)",
          background: "linear-gradient(180deg, rgba(17,26,46,0.98) 0%, rgba(10,16,29,0.98) 100%)"
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 16
        }
      }
    }
  }
});
