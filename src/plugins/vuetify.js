// Styles
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

// Vuetify
import { createVuetify } from "vuetify";

export default createVuetify({
  theme: {
    defaultTheme: "darkblue",
    themes: {
      light: {
        dark: false,
        colors: {
          primary: "#29569b",
        },
      },
      darkblue: {
        dark: false,
        colors: {
          primary: "#1b2a41",
        },
      },
      blue: {
        dark: false,
        colors: {
          primary: "#0b3d62",
        },
      },
      green: {
        dark: false,
        colors: {
          primary: "#077568",
        },
      },
      orange: {
        dark: false,
        colors: {
          primary: "#d24726",
        },
      },
      purple: {
        dark: false,
        colors: {
          primary: "#80397b",
        },
      },
      pink: {
        dark: false,
        colors: {
          primary: "#e91e63",
        },
      },
      black: {
        dark: false,
        colors: {
          primary: "#2e2e2e",
        },
      },
      "ocean-blue-light": {
        dark: false,
        colors: {
          primary: "#006994",
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: "#2e2e2e",
        },
      },
      "dark-blue": {
        dark: true,
        colors: {
          primary: "#29569b",
        },
      },
      "dark-darkblue": {
        dark: true,
        colors: {
          primary: "#1b2a41",
        },
      },
      "dark-navy": {
        dark: true,
        colors: {
          primary: "#0b3d62",
        },
      },
      "dark-green": {
        dark: true,
        colors: {
          primary: "#077568",
        },
      },
      "dark-orange": {
        dark: true,
        colors: {
          primary: "#d24726",
        },
      },
      "dark-purple": {
        dark: true,
        colors: {
          primary: "#80397b",
        },
      },
      "dark-pink": {
        dark: true,
        colors: {
          primary: "#e91e63",
        },
      },
      "ocean-blue": {
        dark: true,
        colors: {
          primary: "#006994",
        },
      },
    },
  },
});
