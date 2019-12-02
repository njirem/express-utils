'use strict';

const nodeVersion = parseInt(process.versions.node.split('.')[0]);

module.exports = {
    clearMocks: true,
    restoreMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: [
        'html',
        'text',
    ],
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            tsConfig: {
                target: nodeVersion <= 8 ? 'es5' : undefined
            }
        }
    },
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    }
}