// Test the Avail SDK to understand its API
try {
  console.log('Testing Avail SDK import...');
  
  // Try different import patterns
  const availSDK = require('avail-js-sdk');
  console.log('Available exports:', Object.keys(availSDK));
  
  // Check for common patterns
  if (availSDK.SDK) {
    console.log('Found SDK class');
  }
  if (availSDK.initialize) {
    console.log('Found initialize function');
  }
  if (availSDK.connect) {
    console.log('Found connect function');
  }
  if (availSDK.Api) {
    console.log('Found Api class');
  }
  if (availSDK.WsProvider) {
    console.log('Found WsProvider');
  }
  
  console.log('Full SDK object structure:');
  console.log(availSDK);
  
} catch (error) {
  console.error('Error importing Avail SDK:', error.message);
}