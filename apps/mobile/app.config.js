const appJson = require("./app.json");

const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();

module.exports = {
  ...appJson.expo,
  web: {
    ...appJson.expo.web,
    output: "single",
  },
  experiments: {
    ...appJson.expo.experiments,
    ...(baseUrl ? { baseUrl } : {}),
  },
};
