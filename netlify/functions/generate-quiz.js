// netlify/functions/generate-quiz.js

// Using global fetch, available in modern Node.js runtimes on Netlify
// If you encounter issues and Netlify logs mention fetch is not defined,
// you might need to install 'node-fetch': npm install node-fetch
// and then uncomment the next line:
// const fetch = require('node-fetch'); 

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        console.error("Netlify Function 'generate-quiz': Gemini API key is not set in environment variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key not configured on the server.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    let topic;
    let numQuestions = 3; // Default number of questions

    try {
        const body = JSON.parse(event.body);
        topic = body.topic;
        if (body.numQuestions && parseInt(body.numQuestions) > 0) {
            numQuestions = parseInt(body.numQuestions);
        }

        if (!topic || typeof topic !== 'string' || topic.trim() === "") {
            console.error("Netlify Function 'generate-quiz': Topic is missing or invalid.");
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Topic is required and must be a non-empty string.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
    } catch (e) {
        console.error("Netlify Function 'generate-quiz': Error parsing request body:", e);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid request body. Expecting JSON with a "topic" field.' }),
            headers: { 'Content-Type': 'application/json' },
        };
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
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            // temperature: 0.7, // Example, uncomment to use
            // maxOutputTokens: 1024, // Example, uncomment to use
        }
    };

    try {
        console.log(`Netlify Function 'generate-quiz': Sending request to Gemini for topic "${topic}"`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text(); 
            console.error(`Netlify Function 'generate-quiz': Gemini API request failed with status ${response.status}:`, errorBody);
            throw new Error(`Gemini API request failed with status ${response.status}. Response: ${errorBody}`);
        }

        const data = await response.json();
        console.log("Netlify Function 'generate-quiz': Raw response from Gemini:", JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            console.error("Netlify Function 'generate-quiz': Unexpected response structure from Gemini API:", data);
            throw new Error('Unexpected response structure from Gemini API.');
        }

        const geminiResponseText = data.candidates[0].content.parts[0].text;
        
        let quizQuestions;
        try {
            quizQuestions = JSON.parse(geminiResponseText);
        } catch (parseError) {
            console.error("Netlify Function 'generate-quiz': Failed to parse Gemini response as JSON:", parseError);
            console.error("Gemini Raw Text was:", geminiResponseText);
            throw new Error('Gemini response was not valid JSON. Check the prompt and model output.');
        }

        if (!Array.isArray(quizQuestions) || quizQuestions.some(q => !q.text || !q.options || q.options.length !== 4 || !q.correctAnswer)) {
            console.error("Netlify Function 'generate-quiz': Parsed JSON is not a valid quiz structure or questions are malformed:", quizQuestions);
            throw new Error('Generated content is not a valid quiz structure or questions are malformed.');
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
            body: JSON.stringify({ error: error.message || 'Failed to generate quiz due to an internal server error.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};