import dotenv from 'dotenv';
dotenv.config();

async function quickTest() {
  const apiKey = process.env.NVIDIA_API_KEY;

  // Test with Llama 3.1 70B (no thinking mode issues)
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [
        { role: 'user', content: 'Should I rebalance my LP position if price moved 3% out of range but volatility is high? Respond ONLY with:\nAction: [rebalance/wait]\nConfidence: [0.0-1.0]\nReasoning: [2-3 sentences]' },
      ],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  console.log('Status:', resp.status);
  const data = await resp.json() as any;
  console.log('Content:', data.choices?.[0]?.message?.content);
}

quickTest().catch(console.error);
