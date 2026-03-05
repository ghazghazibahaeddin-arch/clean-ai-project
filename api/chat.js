const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Initialize Supabase only if keys exist
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = async (req, res) => {
    // 1. Setup CORS & Headers
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Empty prompt' });

        // 2. Privacy Shield (PII Masking)
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const maskedPrompt = prompt.replace(emailRegex, "[MASKED_EMAIL]");

        // 3. Groq API Call
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: maskedPrompt }]
            })
        });

        const data = await groqResponse.json();

        if (!groqResponse.ok) {
            throw new Error(data.error?.message || "Groq API Error");
        }

        const aiReply = data.choices[0].message.content;
        const usage = data.usage || { total_tokens: 0 };
        const estimatedCost = usage.total_tokens * 0.00002;

        // 4. Background Logging to Supabase (Non-blocking)
        if (supabase) {
            supabase.from('ai_logs').insert([
                { 
                    prompt_text: prompt, 
                    response_text: aiReply, 
                    tokens_used: usage.total_tokens, 
                    estimated_cost: estimatedCost,
                    shield_active: prompt !== maskedPrompt
                }
            ]).then(({ error }) => { if(error) console.error("DB Error:", error.message); });
        }

        // 5. Success Response
        return res.status(200).json({
            reply: aiReply,
            governance_log: {
                estimated_cost: `${estimatedCost.toFixed(6)}$`,
                tokens_used: usage.total_tokens,
                shield_active: prompt !== maskedPrompt
            }
        });

    } catch (err) {
        console.error("Fatal Logic Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
};
