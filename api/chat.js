import { createClient } from '@supabase/supabase-js'

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let { prompt } = req.body;
  const originalPrompt = prompt;

  // 🛡️ Privacy Shield: Mask sensitive data before sending to AI
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /\+?[0-9]{10,15}/g;
  
  prompt = prompt.replace(emailRegex, "[MASKED_EMAIL]");
  prompt = prompt.replace(phoneRegex, "[MASKED_PHONE]");

  try {
    // 🧠 Fetch AI Response from Groq
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: "You are a secure corporate AI. Professional and concise." },
            { role: "user", content: prompt }
        ],
        temperature: 0.6
      })
    });

    const data = await groqRes.json();
    
    if (!data.choices) throw new Error(data.error?.message || "AI Provider Error");

    const reply = data.choices[0].message.content;
    const tokens = data.usage?.total_tokens || 0;
    const cost = tokens * 0.00002; // Updated pricing for Llama 3.3 70B

    // 💾 Governance Logging: Save to Supabase
    const { error: dbError } = await supabase.from('ai_logs').insert([
      { 
        prompt_text: originalPrompt, 
        response_text: reply, 
        tokens_used: tokens, 
        estimated_cost: cost,
        shield_active: originalPrompt !== prompt
      }
    ]);

    if (dbError) console.error("Database Log Error:", dbError.message);

    // 📤 Return Response to Frontend
    res.status(200).json({
      reply,
      governance_log: {
        estimated_cost: `${cost.toFixed(6)}$`,
        tokens_used: tokens,
        shield_active: originalPrompt !== prompt
      }
    });

  } catch (error) {
    console.error("Gateway Error:", error.message);
    res.status(500).json({ error: error.message });
  }
        }
