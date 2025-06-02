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
    let numMCQs = 2; // Default MCQs if not specified
    let numSAQs = 1; // Default SAQs if not specified
    let numTotalQuestions;


    try {
        const body = JSON.parse(event.body);
        topic = body.topic;
        // Use provided numbers if valid, otherwise keep defaults
        if (body.numMCQs !== undefined && parseInt(body.numMCQs) >= 0) {
            numMCQs = parseInt(body.numMCQs);
        }
        if (body.numSAQs !== undefined && parseInt(body.numSAQs) >= 0) {
            numSAQs = parseInt(body.numSAQs);
        }
        numTotalQuestions = numMCQs + numSAQs;


        if (!topic || typeof topic !== 'string' || topic.trim() === "") {
            console.error("Netlify Function 'generate-quiz': Topic is missing or invalid.");
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Topic is required and must be a non-empty string.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
        if (numTotalQuestions === 0) {
            console.error("Netlify Function 'generate-quiz': Requested zero questions.");
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Please request at least one question (MCQ or SAQ).' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }

    } catch (e) {
        console.error("Netlify Function 'generate-quiz': Error parsing request body:", e);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid request body. Expecting JSON with a "topic" field, and optional "numMCQs", "numSAQs".' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `
Generate an array of ${numTotalQuestions} unique exam-style questions suitable for an IB Digital Society student on the topic of "${topic}".
The questions should consist of exactly ${numMCQs} Multiple Choice Questions (MCQs) and exactly ${numSAQs} Short Answer Questions (SAQs).
Present them intermingled or grouped, but ensure the total counts for each type are met.

For each MCQ, provide:
1.  "id": A unique string identifier (e.g., "mcq_1", "mcq_${topic.replace(/\s+/g, '-').toLowerCase()}_idx").
2.  "type": "mcq" (string literal "mcq").
3.  "text": The full question text.
4.  "options": An array of exactly 4 distinct string options.
5.  "correctAnswer": A string that exactly matches one of the provided options.
6.  "explanation": A brief explanation for why the correct answer is correct, suitable for a student.
7.  "points": 10 (integer).

For each SAQ (Short Answer Question), provide:
1.  "id": A unique string identifier (e.g., "saq_1", "saq_${topic.replace(/\s+/g, '-').toLowerCase()}_idx").
2.  "type": "saq" (string literal "saq").
3.  "text": The full question text, clearly requiring a written response of a few sentences to a paragraph.
4.  "feedbackHints": Key concepts, terms, or marking points an examiner would look for in an ideal answer. This should guide the student and any AI feedback mechanism.
5.  "points": 20 (integer).

Return ONLY a valid JSON array of these question objects. Do not include any introductory text, surrounding markdown formatting like \`\`\`json, or any other text outside the JSON array.
Example of a mixed array:
[
  { "id": "mcq_topic_1", "type": "mcq", "text": "What is AI ethics primarily concerned with?", "options": ["Algorithm speed", "Moral implications of AI", "Hardware requirements", "Data storage capacity"], "correctAnswer": "Moral implications of AI", "explanation": "AI ethics explores the moral principles and values that should govern the development and use of artificial intelligence.", "points": 10 },
  { "id": "saq_topic_1", "type": "saq", "text": "Explain two ethical considerations when developing facial recognition AI.", "feedbackHints": "Consider privacy, bias, surveillance, consent, accuracy, potential for misuse. Define each consideration and provide a brief example or impact.", "points": 20 }
]
`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            // temperature: 0.7, 
            // maxOutputTokens: 2048, // Increased max tokens slightly
        }
    };

    try {
        console.log(`Netlify Function 'generate-quiz': Sending request for topic "${topic}" (${numMCQs} MCQs, ${numSAQs} SAQs)`);
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
        console.log("Netlify Function 'generate-quiz': Raw response object from Gemini:", JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            console.error("Netlify Function 'generate-quiz': Unexpected response structure from Gemini API:", data);
            throw new Error('Unexpected response structure from Gemini API.');
        }

        let geminiResponseText = data.candidates[0].content.parts[0].text;
        console.log("Netlify Function 'generate-quiz': Raw text from Gemini candidate part (before cleaning):", geminiResponseText);

        // More Robust JSON Extraction Logic
        const match = geminiResponseText.match(/```json\s*([\s\S]*?)\s*```|([\s\S]*)/);
        let cleanedJsonText = "";
        if (match) {
            cleanedJsonText = match[1] ? match[1].trim() : match[2].trim();
        } else {
            cleanedJsonText = geminiResponseText.trim();
        }
        
        if (!cleanedJsonText.startsWith('[') && !cleanedJsonText.startsWith('{')) {
            const firstBracket = cleanedJsonText.indexOf('[');
            const firstBrace = cleanedJsonText.indexOf('{');
            if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
                cleanedJsonText = cleanedJsonText.substring(firstBracket);
            } else if (firstBrace !== -1) {
                cleanedJsonText = cleanedJsonText.substring(firstBrace);
            }
        }
        if (cleanedJsonText.startsWith('[') && !cleanedJsonText.endsWith(']')) {
            const lastBracket = cleanedJsonText.lastIndexOf(']');
            if (lastBracket !== -1) cleanedJsonText = cleanedJsonText.substring(0, lastBracket + 1);
        } else if (cleanedJsonText.startsWith('{') && !cleanedJsonText.endsWith('}')) {
            const lastBrace = cleanedJsonText.lastIndexOf('}');
            if (lastBrace !== -1) cleanedJsonText = cleanedJsonText.substring(0, lastBrace + 1);
        }

        console.log("Netlify Function 'generate-quiz': Text after attempting to clean for JSON parsing:", cleanedJsonText);
        
        let quizQuestions;
        try {
            quizQuestions = JSON.parse(cleanedJsonText);
        } catch (parseError) {
            console.error("Netlify Function 'generate-quiz': Failed to parse cleaned Gemini response as JSON:", parseError);
            console.error("Netlify Function 'generate-quiz': Cleaned Gemini text that failed parsing:", cleanedJsonText);
            throw new Error('Gemini response, even after cleaning, was not valid JSON.');
        }

        if (!Array.isArray(quizQuestions)) {
             console.error("Netlify Function 'generate-quiz': Parsed JSON is not an array:", quizQuestions);
            throw new Error('Generated content is not a valid quiz array.');
        }
        // Basic validation for question structure
        const allQuestionsValid = quizQuestions.every(q => 
            q.text && q.type && 
            (q.type === 'mcq' ? (q.options && q.options.length === 4 && q.correctAnswer) : true) &&
            (q.type === 'saq' ? (q.feedbackHints) : true)
        );

        if (!allQuestionsValid) {
            console.error("Netlify Function 'generate-quiz': Parsed JSON contains malformed questions:", quizQuestions);
            throw new Error('Generated content contains malformed quiz questions.');
        }


        return {
            statusCode: 200,
            body: JSON.stringify({ 
                quiz: {
                    id: `live-quiz-${topic.replace(/\s+/g, '-')}-${Date.now()}`, 
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
