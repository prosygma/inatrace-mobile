module.exports = (config) => {
  return {
    ...config,
    android: {
      ...config.android,
      packageImport: 'import io.inatrace.fs.RNfsPackage;',
      packageInstance: 'new RNfsPackage()',
    },
  };
};
