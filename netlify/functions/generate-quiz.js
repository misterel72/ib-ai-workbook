// netlify/functions/generate-quiz.js

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        console.error("Netlify Function 'generate-quiz': Gemini API key is not set.");
        return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    let topic;
    let numMCQs = 2; // Default MCQs
    let numSAQs = 1; // Default SAQs
    let numTotalQuestions;

    try {
        const body = JSON.parse(event.body);
        topic = body.topic;
        if (body.numMCQs && parseInt(body.numMCQs) >= 0) numMCQs = parseInt(body.numMCQs);
        if (body.numSAQs && parseInt(body.numSAQs) >= 0) numSAQs = parseInt(body.numSAQs);
        numTotalQuestions = numMCQs + numSAQs;

        if (!topic || typeof topic !== 'string' || topic.trim() === "") {
            return { statusCode: 400, body: JSON.stringify({ error: 'Topic is required.' }) };
        }
        if (numTotalQuestions === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Please request at least one question (MCQ or SAQ).' }) };
        }

    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `
Generate an array of ${numTotalQuestions} unique exam-style questions suitable for an IB Digital Society student on the topic of "${topic}".
The questions should consist of exactly ${numMCQs} Multiple Choice Questions (MCQs) and exactly ${numSAQs} Short Answer Questions (SAQs).
Present them intermingled or grouped, but ensure the total counts are met.

For each MCQ, provide:
1.  "id": A unique string identifier (e.g., "mcq1", "mcq_${topic.replace(/\s+/g, '-').toLowerCase()}_1").
2.  "type": "mcq" (string literal "mcq").
3.  "text": The full question text.
4.  "options": An array of exactly 4 distinct string options.
5.  "correctAnswer": A string that exactly matches one of the provided options.
6.  "explanation": A brief explanation for why the correct answer is correct, suitable for a student.
7.  "points": 10 (integer).

For each SAQ (Short Answer Question), provide:
1.  "id": A unique string identifier (e.g., "saq1", "saq_${topic.replace(/\s+/g, '-').toLowerCase()}_1").
2.  "type": "saq" (string literal "saq").
3.  "text": The full question text, clearly requiring a written response of a few sentences to a paragraph.
4.  "feedbackHints": Key concepts, terms, or marking points an examiner would look for in an ideal answer. This should guide the student and any AI feedback mechanism.
5.  "points": 20 (integer).

Return ONLY a valid JSON array of these question objects. Do not include any introductory text, surrounding markdown formatting like \`\`\`json, or any other text outside the JSON array.
Example of a mixed array:
[
  { "id": "mcq_topic_1", "type": "mcq", "text": "What is AI ethics primarily concerned with?", "options": ["Algorithm speed", "Moral implications of AI", "Hardware requirements", "Data storage capacity"], "correctAnswer": "Moral implications of AI", "explanation": "AI ethics explores the moral principles and values that should govern the development and use of artificial intelligence.", "points": 10 },
  { "id": "saq_topic_1", "type": "saq", "text": "Explain two ethical considerations when developing facial recognition AI.", "feedbackHints": "Consider privacy, bias, surveillance, consent, accuracy, potential for misuse. Define each consideration and provide a brief example or impact.", "points": 20 },
  { "id": "mcq_topic_2", "type": "mcq", "text": "Which type of AI is Siri an example of?", "options": ["AGI", "ASI", "Narrow AI", "Robotics"], "correctAnswer": "Narrow AI", "explanation": "Siri is designed for specific tasks and operates within a limited, predefined range of functions, characteristic of Narrow AI.", "points": 10 }
]
`;

    const requestBody = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        console.log(`Netlify Function 'generate-quiz': Sending request for topic "${topic}" (${numMCQs} MCQs, ${numSAQs} SAQs)`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text(); 
            console.error(`Gemini API request failed: ${response.status}`, errorBody);
            throw new Error(`Gemini API request failed: ${response.status}. ${errorBody}`);
        }

        const data = await response.json();
        console.log("Raw response object from Gemini:", JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]) {
            throw new Error('Unexpected response structure from Gemini API.');
        }

        let geminiResponseText = data.candidates[0].content.parts[0].text;
        console.log("Raw text from Gemini part (before cleaning):", geminiResponseText);

        const match = geminiResponseText.match(/```json\s*([\s\S]*?)\s*```|([\s\S]*)/);
        let cleanedJsonText = match ? (match[1] ? match[1].trim() : match[2].trim()) : geminiResponseText.trim();
        
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
        console.log("Text after cleaning for JSON parsing:", cleanedJsonText);
        
        let quizQuestions;
        try {
            quizQuestions = JSON.parse(cleanedJsonText);
        } catch (parseError) {
            console.error("Failed to parse cleaned Gemini response as JSON:", parseError, "Cleaned text was:", cleanedJsonText);
            throw new Error('Gemini response was not valid JSON after cleaning.');
        }

        if (!Array.isArray(quizQuestions)) {
             console.error("Parsed JSON is not an array:", quizQuestions);
            throw new Error('Generated content is not a valid quiz array.');
        }
        // Add more validation for question structure if needed

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                quiz: {
                    id: `live-mod-quiz-${topic.replace(/\s+/g, '-')}-${Date.now()}`, 
                    title: `Live Quiz: ${topic}`,
                    questions: quizQuestions,
                    quizType: 'live' // Add this so QuizView knows not to record points
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