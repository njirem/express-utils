const nodeVersion = parseInt(process.versions.node.split('.')[0]);

module.exports = nodeVersion > 8 ? require('./dist/index') : require('./dist/es5/index');
