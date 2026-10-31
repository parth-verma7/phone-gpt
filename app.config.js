// Match Expo's development launcher metadata to the separate Android debug app.
module.exports = ({ config }) => process.env.APP_VARIANT === 'development'
  ? {
    ...config,
    name: 'PhoneGPT Dev',
    scheme: 'exp+phone-gpt-dev',
    android: { ...config.android, package: 'com.phonegpt.app.dev' },
  }
  : config;
