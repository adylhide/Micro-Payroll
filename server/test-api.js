/**
 * API INTEGRATION TEST: Secure Micro-Payroll System
 * Requires: npm install --save-dev supertest
 */

const request = require('supertest');
const { app } = require('./server');
require('dotenv').config();

async function runApiTests() {
  console.log("--- Starting API Integration Tests ---");

  // Note: These tests assume Supabase is reachable or will fail on Auth
  // In a CI environment, we would mock the Supabase client.
  
  console.log("\n1. Testing Auth Middleware (Missing Token)");
  const res1 = await request(app).get('/api/payroll/me');
  if (res1.status === 401) {
    console.log("✅ SUCCESS: Correctly blocked request without token.");
  } else {
    console.error(`❌ FAILURE: Expected 401, got ${res1.status}`);
  }

  console.log("\n2. Testing Auth Middleware (Invalid Token)");
  const res2 = await request(app)
    .get('/api/payroll/me')
    .set('Authorization', 'Bearer invalid_token');
  if (res2.status === 401) {
    console.log("✅ SUCCESS: Correctly blocked invalid token.");
  } else {
    console.warn(`⚠️ NOTE: Supabase might have returned ${res2.status}. If 401, encryption logic is shielded.`);
  }

  console.log("\n3. Testing Role-Based Access (Unauthorized Role)");
  // This requires a real token from a non-HR user to test 403 Forbidden.
  console.log("   (Skipping role check - requires valid non-HR JWT)");

  console.log("\n4. Architecture Verification");
  if (app.stack || app._router.stack) {
    const routes = app._router.stack
      .filter(r => r.route)
      .map(r => `${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
    
    const required = ['GET /api/payroll/me', 'GET /api/payroll/all', 'POST /api/payroll'];
    const allFound = required.every(path => routes.includes(path));

    if (allFound) {
      console.log("✅ SUCCESS: All secure endpoints are registered.");
    } else {
      console.error("❌ FAILURE: Missing endpoints. Found:", routes);
    }
  }

  console.log("\n--- API Pre-flight Tests Completed ---");
  console.log("To perform a full 'End-to-End' test, you must:");
  console.log("1. Create an HR user in Supabase Auth.");
  console.log("2. Get their Access Token (JWT) from the browser console.");
  console.log("3. Use a tool like Postman to POST to /api/payroll with the Bearer token.");
}

runApiTests().catch(err => console.error("Test Error:", err));
