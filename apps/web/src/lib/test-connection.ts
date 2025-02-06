// debug-connection.ts
const SERVER_URL = 'http://192.168.0.76:11434';

async function debugConnection() {
  try {
    // 1. Check available models explicitly
    console.log('1. Checking available models...');
    const modelResponse = await fetch(`${SERVER_URL}/api/tags`);
    const modelData = await modelResponse.json();
    console.log('Raw model data:', JSON.stringify(modelData, null, 2));

    // 2. If no models are available, we need to pull one
    if (!modelData.models?.length) {
      console.log('\nNo models found. Attempting to list downloadable models...');
      const response = await fetch(`${SERVER_URL}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'deepseek-coder:6.7b' })
      });
      const data = await response.json();
      console.log('Model info:', data);
    }

    // 3. Test with explicit error handling
    console.log('\n3. Testing chat endpoint...');
    const chatResponse = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-coder:6.7b',
        messages: [{ role: 'user', content: 'Say hello!' }]
      })
    });

    console.log('Response status:', chatResponse.status);
    const responseText = await chatResponse.text();
    console.log('Raw response:', responseText);

    try {
      const jsonResponse = JSON.parse(responseText);
      console.log('Parsed response:', jsonResponse);
    } catch (e) {
      console.log('Could not parse response as JSON');
    }

  } catch (error) {
    console.error('Debug failed:', error);
  }
}

debugConnection();
