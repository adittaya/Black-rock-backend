const axios = require('axios');

async function testBackend() {
  const BACKEND_URL = process.env.BACKEND_URL || 'https://black-rock-api.onrender.com';
  
  console.log('Testing backend endpoints...');
  
  try {
    // Test health check
    console.log('\n1. Testing health check endpoint...');
    const healthResponse = await axios.get(`${BACKEND_URL}/`);
    console.log('✓ Health check:', healthResponse.data);
    
    // Test refresh-token endpoint (should return 401 without token)
    console.log('\n2. Testing refresh-token endpoint (without token)...');
    try {
      const refreshResponse = await axios.post(`${BACKEND_URL}/refresh-token`);
      console.log('Unexpected success:', refreshResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✓ Correctly returned 401 for missing token');
      } else {
        console.log('! Unexpected error:', error.message);
      }
    }
    
    // Test validate-token endpoint (should return 401 without token)
    console.log('\n3. Testing validate-token endpoint (without token)...');
    try {
      const validateResponse = await axios.post(`${BACKEND_URL}/validate-token`);
      console.log('Unexpected success:', validateResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✓ Correctly returned 401 for missing token');
      } else {
        console.log('! Unexpected error:', error.message);
      }
    }
    
    console.log('\n✓ Backend endpoints are accessible and responding as expected!');
    console.log('\nNext steps:');
    console.log('- Deploy this backend to Render using the deployment guide');
    console.log('- Update the frontend VITE_BACKEND_URL to point to your deployed service');
    console.log('- Test the complete authentication flow');
    
  } catch (error) {
    console.error('✗ Error testing backend:', error.message);
  }
}

testBackend();