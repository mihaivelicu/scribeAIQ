// src/theme.js

import './styles/_tokens.css';
import { createTheme } from '@mui/material/styles';

const css = (v) =>
  getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const theme = createTheme({
  palette: {
    primary: { main: css('--color-primary-500'), dark: css('--color-primary-600') },
    secondary: { main: css('--color-accent-500') },
    warning: { main: css('--color-warning-500') },
    error: { main: css('--color-danger-500') },
    background: { default: css('--color-bg-sidebar') },
  },
  typography: {
    fontFamily: css('--ff-base'),
    h6: {
      fontSize: css('--fs-16'),
      fontWeight: css('--fw-700'),
      color: css('--color-text-heading'),
    },
    body2: {
      color: css('--color-text-body'),
    },
  },
  shape: { borderRadius: 4 },
});

export default theme;
