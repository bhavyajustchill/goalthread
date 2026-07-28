import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;

try {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const data = await res.json();
  if (data.data) {
    console.log(`Total models available on OpenRouter: ${data.data.length}`);
    const freeModels = data.data.filter((m) => m.id.endsWith(':free') || m.pricing?.prompt === '0');
    console.log('\n--- FREE MODELS ON OPENROUTER ---');
    freeModels.forEach((m) => {
      console.log(`ID: ${m.id} | Name: ${m.name}`);
    });

    if (freeModels.length === 0) {
      console.log('\n--- TOP LOW-COST / POPULAR MODELS ---');
      data.data.slice(0, 15).forEach((m) => {
        console.log(`ID: ${m.id} | Pricing: prompt $${m.pricing?.prompt}, completion $${m.pricing?.completion}`);
      });
    }
  } else {
    console.log('API error response:', data);
  }
} catch (err) {
  console.log('Fetch error:', err.message);
}
