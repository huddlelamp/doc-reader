Package.describe({
  name: 'raedle:elasticsearch-admin',
  summary: "An extension for elastic search.",
  version: "1.0.0"
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.0');

  api.use('standard-app-packages');
  api.use('http');
  api.use('underscore', 'server');

  api.use('iron:router');
  api.use('raedle:file-info', 'server');

  if (api.export) {
    api.export('IndexSettings');
    api.export('ElasticSearch', 'client');
  }

  api.addFiles('lib/elasticsearch.js', 'client');

  api.addFiles('model/index-model.js');

  api.addFiles('client/admin/index/index.html', 'client');
  api.addFiles('client/admin/index/index.js', 'client');
});
