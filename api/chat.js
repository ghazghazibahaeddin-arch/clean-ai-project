// api/chat.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { prompt, licenseKey } = req.body;

    // 1. التحقق من الرخصة (Security First)
    // ملاحظة: هنا سنفترض التحقق البسيط، وفي المرحلة القادمة نربطه بـ Supabase
    if (!licenseKey || !licenseKey.startsWith('sk_live_')) {
        return res.status(401).json({ error: "Invalid License Key" });
    }

    try {
        // 2. إرسال الطلب لـ Gemini باستخدام المفتاح المخفي في Vercel
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";

        // 3. الرد على العميل
        res.status(200).json({ reply });
    } catch (error) {
        res.status(500).json({ error: "Gateway Error" });
    }
                            }
  
