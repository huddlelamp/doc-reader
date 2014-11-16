Package.describe({
  name: 'raedle:file-info',
  summary: "Simple file uploading for Meteor.",
  version: "1.0.0"
});

Package.onUse(function (api) {
  api.versionsFrom('METEOR@0.9.0');

  api.use('standard-app-packages');
  api.use('underscore');
  api.use('ejson');

  api.export('FileInfo');

  api.addFiles('file-info.js');
});

Package.onTest(function(api) {
  api.use('tinytest');
  // api.use('raedle:file-info');
  // api.addFiles('test/raedle:file-info-tests.js');
});
