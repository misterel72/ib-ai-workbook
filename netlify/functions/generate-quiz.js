// netlify/functions/generate-quiz.js

exports.handler = async function(event, context) {
    // ... (HTTP method check, API key check, request body parsing - same as before) ...
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        console.error("Netlify Function 'generate-quiz': Gemini API key is not set.");
        return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured.' }) };
    }
    let topic;
    let numQuestions = 3;
    try {
        const body = JSON.parse(event.body);
        topic = body.topic;
        if (body.numQuestions && parseInt(body.numQuestions) > 0) numQuestions = parseInt(body.numQuestions);
        if (!topic || typeof topic !== 'string' || topic.trim() === "") {
            console.error("Netlify Function 'generate-quiz': Topic missing or invalid.");
            return { statusCode: 400, body: JSON.stringify({ error: 'Topic is required.' }) };
        }
    } catch (e) {
        console.error("Netlify Function 'generate-quiz': Error parsing request body:", e);
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `
Generate an array of ${numQuestions} unique quiz questions suitable for an IB Digital Society student on the topic of "${topic}".
Each question should be multiple-choice with exactly 4 distinct options.
For each question, provide:
1.  "id": A unique string identifier for the question (e.g., "q1", "q2", "q${numQuestions}").
2.  "text": The full question text.
3.  "options": An array of 4 strings representing the choices.
4.  "correctAnswer": A string that exactly matches one of the provided options.
5.  "explanation": A brief explanation for why the correct answer is correct, suitable for a student.
6.  "type": "mcq" (string literal "mcq")
7.  "points": 10 (integer)

Return ONLY a valid JSON array of these question objects. Do not include any introductory text, surrounding markdown formatting like \`\`\`json, or any other text outside the JSON array.
Example of one question object:
{
  "id": "q1",
  "text": "What is the primary purpose of a firewall?",
  "options": ["To prevent unauthorized access", "To speed up internet connection", "To store website data", "To clean viruses"],
  "correctAnswer": "To prevent unauthorized access",
  "explanation": "A firewall acts as a barrier between a trusted network and an untrusted network, controlling incoming and outgoing network traffic based on an applied rule set.",
  "type": "mcq",
  "points": 10
}
`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        // It might be useful to ask Gemini to output JSON directly if the model supports it
        // generationConfig: {
        //    responseMimeType: "application/json",
        // }
    };

    try {
        console.log(`Netlify Function 'generate-quiz': Sending request for topic "${topic}"`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text(); 
            console.error(`Gemini API request failed with status ${response.status}:`, errorBody);
            throw new Error(`Gemini API request failed: ${response.status}. ${errorBody}`);
        }

        const data = await response.json();
        console.log("Raw response object from Gemini:", JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            console.error("Unexpected response structure from Gemini API:", data);
            throw new Error('Unexpected response structure from Gemini API.');
        }

        let geminiResponseText = data.candidates[0].content.parts[0].text;
        console.log("Raw text from Gemini candidate part (before cleaning):", geminiResponseText);

        // **More Robust JSON Extraction Logic**
        const match = geminiResponseText.match(/```json\s*([\s\S]*?)\s*```|([\s\S]*)/);
        let cleanedJsonText = "";
        if (match) {
            // If ```json ... ``` is found, use the content inside.
            // Otherwise, assume the whole string might be JSON (or try to find an array/object).
            cleanedJsonText = match[1] ? match[1].trim() : match[2].trim();
        } else {
            // Fallback if regex doesn't match as expected (shouldn't happen with the current regex)
            cleanedJsonText = geminiResponseText.trim();
        }
        
        // Second pass: if it's still not starting with [ or {, try to find the first [ or {
        if (!cleanedJsonText.startsWith('[') && !cleanedJsonText.startsWith('{')) {
            const firstBracket = cleanedJsonText.indexOf('[');
            const firstBrace = cleanedJsonText.indexOf('{');

            if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
                cleanedJsonText = cleanedJsonText.substring(firstBracket);
            } else if (firstBrace !== -1) {
                cleanedJsonText = cleanedJsonText.substring(firstBrace);
            }
        }
        // And ensure it ends correctly if it started with a bracket/brace
        if (cleanedJsonText.startsWith('[') && !cleanedJsonText.endsWith(']')) {
            const lastBracket = cleanedJsonText.lastIndexOf(']');
            if (lastBracket !== -1) cleanedJsonText = cleanedJsonText.substring(0, lastBracket + 1);
        } else if (cleanedJsonText.startsWith('{') && !cleanedJsonText.endsWith('}')) {
            const lastBrace = cleanedJsonText.lastIndexOf('}');
            if (lastBrace !== -1) cleanedJsonText = cleanedJsonText.substring(0, lastBrace + 1);
        }

        console.log("Text after attempting to clean for JSON parsing:", cleanedJsonText);
        
        let quizQuestions;
        try {
            quizQuestions = JSON.parse(cleanedJsonText);
        } catch (parseError) {
            console.error("Failed to parse cleaned Gemini response as JSON:", parseError);
            console.error("Cleaned Gemini text that failed parsing:", cleanedJsonText); // Log the problematic text
            throw new Error('Gemini response, even after cleaning, was not valid JSON.');
        }

        if (!Array.isArray(quizQuestions) || quizQuestions.some(q => !q.text || !q.options || q.options.length !== 4 || !q.correctAnswer)) {
            console.error("Parsed JSON is not a valid quiz structure or questions malformed:", quizQuestions);
            throw new Error('Generated content is not a valid quiz structure.');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                quiz: {
                    id: `live-quiz-${Date.now()}`, 
                    title: `Live Quiz on: ${topic}`,
                    questions: quizQuestions,
                }
            }),
            headers: { 'Content-Type': 'application/json' },
        };
    } catch (error) {
        console.error("Netlify Function 'generate-quiz': Error processing request:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Failed to generate quiz.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};