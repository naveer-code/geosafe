const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');

describe('GeoSafe API Tests', () => {
  beforeAll(async () => {
    // Ensure database is connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/geosafe-test');
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('POST /api/route-safety', () => {
    it('should reject invalid coordinates', async () => {
      const response = await request(app)
        .post('/api/route-safety')
        .send({ coordinates: [] });
      expect(response.status).toBe(400);
    });

    it('should reject out-of-range coordinates', async () => {
      const response = await request(app)
        .post('/api/route-safety')
        .send({ coordinates: [[200, 300]] });
      expect(response.status).toBe(400);
    });

    it('should process valid coordinates', async () => {
      const response = await request(app)
        .post('/api/route-safety')
        .send({
          coordinates: [
            [17.3850, 78.4860],
            [17.3860, 78.4870],
            [17.3870, 78.4880]
          ]
        });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('segments');
      expect(response.body).toHaveProperty('hazards');
      expect(response.body).toHaveProperty('metadata');
    });
  });

  describe('GET /api/stats', () => {
    it('should return statistics', async () => {
      const response = await request(app).get('/api/stats');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('byType');
      expect(response.body).toHaveProperty('byCategory');
    });
  });

  describe('GET /api/hazards', () => {
    it('should return hazards list', async () => {
      const response = await request(app).get('/api/hazards');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hazards');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should support type filtering', async () => {
      const response = await request(app)
        .get('/api/hazards')
        .query({ type: 'murder' });
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/seed-compendium', () => {
    it('should reject missing admin key', async () => {
      const response = await request(app).get('/api/seed-compendium');
      expect(response.status).toBe(403);
    });

    it('should reject invalid admin key', async () => {
      const response = await request(app)
        .get('/api/seed-compendium')
        .set('x-admin-key', 'wrong-key');
      expect(response.status).toBe(403);
    });
  });
});
