"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const server_1 = require("../src/server");
(0, vitest_1.describe)('POST /api/generate', () => {
    const app = (0, server_1.createServer)();
    (0, vitest_1.it)('returns mocked content for valid payload', async () => {
        const response = await (0, supertest_1.default)(app)
            .post('/api/generate')
            .send({
            sectionId: 'sec-1',
            sectionTitle: 'Test Section',
            prompt: 'Generate a summary based on sample data.',
            selectedSourceIds: ['src-1']
        });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.metadata.sectionId).toBe('sec-1');
        (0, vitest_1.expect)(response.body.metadata.sources).toEqual([
            vitest_1.expect.objectContaining({ id: 'src-1', name: vitest_1.expect.any(String) })
        ]);
        (0, vitest_1.expect)(response.body.metadata.codexUsed).toBe(false);
        (0, vitest_1.expect)(typeof response.body.content).toBe('string');
    });
    (0, vitest_1.it)('rejects invalid payloads', async () => {
        const response = await (0, supertest_1.default)(app).post('/api/generate').send({});
        (0, vitest_1.expect)(response.status).toBe(400);
        (0, vitest_1.expect)(response.body.error).toBe('ValidationError');
    });
});
