'use strict';

module.exports.addOldNodeSupport = () => {
    Symbol.asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");
}

const nodeVersion = parseInt(process.versions.node.split('.')[0]);
module.exports.oldNodeVersion = nodeVersion <= 8;
