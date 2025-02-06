// test-llm.ts
async function testLLM() {
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-coder:6.7b',
        messages: [
          {
            role: 'user',
            content: 'Say hello!'
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('LLM Response:', data);

  } catch (error) {
    console.error('Error testing LLM:', error);
  }
}

testLLM();
