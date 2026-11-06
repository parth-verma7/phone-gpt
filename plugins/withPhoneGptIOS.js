const { withInfoPlist, withXcodeProject } = require('expo/config-plugins');

// Match Android: Debug is a separate Dev app; Release is standalone PhoneGPT.
module.exports = function withPhoneGptIOS(config) {
  config = withInfoPlist(config, result => {
    result.modResults.CFBundleDisplayName = '$(PHONEGPT_DISPLAY_NAME)';
    result.modResults.CFBundleURLTypes = [{ CFBundleURLSchemes: ['$(PHONEGPT_URL_SCHEME)'] }];
    return result;
  });
  return withXcodeProject(config, result => {
    const configurations = result.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (!entry || typeof entry !== 'object' || !entry.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER) continue;
      const development = String(entry.name).replace(/"/g, '') === 'Debug';
      entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = development ? '"com.phonegpt.app.dev"' : '"com.phonegpt.app"';
      entry.buildSettings.PHONEGPT_DISPLAY_NAME = development ? '"PhoneGPT Dev"' : '"PhoneGPT"';
      entry.buildSettings.PHONEGPT_URL_SCHEME = development ? '"exp+phone-gpt-dev"' : '"exp+phone-gpt"';
    }
    return result;
  });
};
