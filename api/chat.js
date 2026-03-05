const { createClient } = require('@supabase/supabase-js');

// 1. Initialize Supabase Client
// Note: We use the built-in fetch of Node 24
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
    // 2. Set Response Headers
    res.setHeader('Content-Type', 'application/json');

    // 3. Handle Method Security
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const originalPrompt = prompt;

        // 4. Privacy Shield: Mask sensitive emails before AI processing
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const maskedPrompt = prompt.replace(emailRegex, "[MASKED_EMAIL]");

        // 5. Groq AI Integration
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a secure AI governance assistant." },
                    { role: "user", content: maskedPrompt }
                ],
                temperature: 0.7
            })
        });

        const data = await groqResponse.json();

        if (!groqResponse.ok) {
            throw new Error(data.error?.message || "Groq AI connection failed");
        }

        const aiReply = data.choices[0].message.content;
        const totalTokens = data.usage?.total_tokens || 0;
        const estimatedCost = totalTokens * 0.00002;

        // 6. Governance Logging: Store transaction in Supabase
        // We run this without 'await' to respond faster to the user
        supabase.from('ai_logs').insert([
            {
                prompt_text: originalPrompt,
                response_text: aiReply,
                tokens_used: totalTokens,
                estimated_cost: estimatedCost,
                shield_active: originalPrompt !== maskedPrompt
            }
        ]).then(({ error }) => {
            if (error) console.error("Supabase Log Error:", error.message);
        });

        // 7. Final Response to User
        return res.status(200).json({
            reply: aiReply,
            governance_log: {
                status: "SECURE",
                cost: `$${estimatedCost.toFixed(6)}`,
                shield_active: originalPrompt !== maskedPrompt
            }
        });

    } catch (err) {
        console.error("Gateway Fatal Error:", err.message);
        return res.status(500).json({ error: "Internal Gateway Error" });
    }
};
