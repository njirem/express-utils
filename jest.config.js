'use strict';
const { oldNodeVersion } = require('./compatibility');

module.exports = {
    clearMocks: true,
    restoreMocks: true,
    collectCoverage: true,
    collectCoverageFrom: ['src/**'],
    coverageDirectory: 'coverage',
    coverageReporters: [
        'html',
        'text',
    ],
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            tsConfig: {
                target: oldNodeVersion ? 'es5' : undefined
            }
        }
    },
    setupFilesAfterEnv: ['./test-setup.js'],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    }
}