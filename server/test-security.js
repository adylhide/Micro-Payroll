/**
 * TEST SCRIPT: Secure Micro-Payroll System
 * Focus: Data at Rest (Encryption/Decryption)
 */

const { encrypt, decrypt } = require('./server');
require('dotenv').config();

function runTests() {
  console.log("--- Starting Security Tests ---");

  // 1. Verify ENCRYPTION_SECRET is set
  if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET === 'your_32_character_secret') {
    console.error("❌ ERROR: ENCRYPTION_SECRET is not set in .env");
    return;
  }
  console.log("✅ ENCRYPTION_SECRET detected.");

  // 2. Test Encryption/Decryption Consistency
  const testData = "75000";
  console.log(`\nTesting with value: "${testData}"`);

  const encrypted = encrypt(testData);
  console.log(`Encrypted String: ${encrypted}`);

  if (encrypted === testData) {
    console.error("❌ FAILURE: Data was not encrypted (Ciphertext matches Plaintext).");
  } else {
    console.log("✅ SUCCESS: Data is encrypted.");
  }

  const decrypted = decrypt(encrypted);
  console.log(`Decrypted Value: ${decrypted}`);

  if (decrypted === testData) {
    console.log("✅ SUCCESS: Decrypted value matches original data.");
  } else {
    console.error(`❌ FAILURE: Decrypted value ("${decrypted}") does not match original.`);
  }

  // 3. Verify IV (Initialization Vector) Randomness
  const encrypted2 = encrypt(testData);
  if (encrypted !== encrypted2) {
    console.log("✅ SUCCESS: Initialization Vector is unique per encryption (Cybertexts differ).");
  } else {
    console.warn("⚠️ WARNING: Encrypted values are identical. IV might not be rotating.");
  }

  console.log("\n--- Tests Completed Successfully ---");
}

runTests();
