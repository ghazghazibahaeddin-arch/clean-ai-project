const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // دعم CORS و JSON
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST allowed' });
    }

    try {
        const { prompt } = req.body;
        
        // فحص المفاتيح (للتأكد من أن Vercel يراها)
        if (!process.env.GROQ_API_KEY || !process.env.SUPABASE_URL) {
            return res.status(500).json({ error: 'Missing API Keys in Vercel Settings' });
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await groqRes.json();
        const reply = data.choices[0].message.content;

        // محاولة الحفظ في سوبابيس (اختياري لكي لا يعطل الشات)
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        await supabase.from('ai_logs').insert([{ prompt_text: prompt, response_text: reply }]);

        return res.status(200).json({ reply: reply });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
