'use strict';
const { oldNodeVersion } = require('./compatibility');

module.exports = {
    clearMocks: true,
    restoreMocks: true,
    roots: ['src'],
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
                target: oldNodeVersion ? 'es2015' : undefined
            }
        }
    },
    setupFilesAfterEnv: ['./test-setup.js'],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    }
}