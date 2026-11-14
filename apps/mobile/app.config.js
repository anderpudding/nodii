// EAS signs the TestFlight/App Store profile with the production APNs environment.
export default ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE !== 'production') return config;
  return {
    ...config,
    ios: {
      ...config.ios,
      entitlements: { ...config.ios?.entitlements, 'aps-environment': 'production' },
    },
  };
};
