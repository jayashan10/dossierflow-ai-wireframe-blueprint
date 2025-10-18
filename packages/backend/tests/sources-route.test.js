"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const server_1 = require("../src/server");
(0, vitest_1.describe)('GET /api/sources', () => {
    const app = (0, server_1.createServer)();
    (0, vitest_1.it)('returns all sources by default', async () => {
        const response = await (0, supertest_1.default)(app).get('/api/sources');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(response.body.sources)).toBe(true);
        (0, vitest_1.expect)(response.body.sources.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('filters by search term', async () => {
        const response = await (0, supertest_1.default)(app).get('/api/sources').query({ search: 'safety' });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.sources.every((source) => source.name.toLowerCase().includes('safety'))).toBe(true);
    });
});
