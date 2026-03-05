// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // CURRENT SUPPORTED MODELS (Choose one):
        // 1. "llama-3.3-70b-versatile" (Powerful & Smart)
        // 2. "llama-3.1-8b-instant" (Extremely Fast)
        model: "llama-3.3-70b-versatile", 
        messages: [
          { role: "system", content: "You are a helpful and concise AI assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (data.error) {
       return res.status(400).json({ error: data.error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
