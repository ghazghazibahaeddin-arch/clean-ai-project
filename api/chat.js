// 1. استخدام require لضمان التوافق مع Vercel Node Runtime
const { createClient } = require('@supabase/supabase-js');

// 2. تعريف السوبابيس خارج الدالة لتسريع الأداء
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  // التأكد من أن الطريقة POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

    const originalPrompt = prompt;
    // حماية الخصوصية (Masking)
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const maskedPrompt = prompt.replace(emailRegex, "[MASKED_EMAIL]");

    // الاتصال بـ Groq
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

    const data = await groqRes.json();
    
    // التحقق من رد Groq
    if (!data.choices || !data.choices[0]) {
        throw new Error(data.error?.message || "Invalid response from AI provider");
    }

    const reply = data.choices[0].message.content;
    const tokens = data.usage?.total_tokens || 0;
    const cost = tokens * 0.00002;

    // محاولة التخزين في Supabase (مع تجاوز الخطأ إذا فشل لكي لا يتوقف الشات)
    try {
        await supabase.from('ai_logs').insert([
          { 
            prompt_text: originalPrompt, 
            response_text: reply, 
            tokens_used: tokens, 
            estimated_cost: cost,
            shield_active: originalPrompt !== maskedPrompt
          }
        ]);
    } catch (dbErr) {
        console.error("DB Save Error:", dbErr.message);
    }

    // إرسال الرد النهائي
    return res.status(200).json({
      reply: reply,
      governance_log: {
        estimated_cost: `${cost.toFixed(6)}$`,
        tokens_used: tokens,
        shield_active: originalPrompt !== maskedPrompt
      }
    });

  } catch (error) {
    console.error("Server Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
