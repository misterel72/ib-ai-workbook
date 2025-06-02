// netlify/functions/generate-feedback.js

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        console.error("Netlify Function 'generate-feedback': Gemini API key is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key not configured on the server.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    let questionText, studentAnswer, feedbackHints, points;

    try {
        const body = JSON.parse(event.body);
        questionText = body.questionText;
        studentAnswer = body.studentAnswer;
        feedbackHints = body.feedbackHints;
        points = body.points || 10; // Default points if not provided

        if (!questionText || !studentAnswer) {
            console.error("Netlify Function 'generate-feedback': Missing questionText or studentAnswer.");
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields: questionText and studentAnswer are required.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
    } catch (e) {
        console.error("Netlify Function 'generate-feedback': Error parsing request body:", e);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid request body.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `
You are an expert IB Digital Society examiner providing feedback on a student's short answer.
The question was: "${questionText}"
The student's answer is: "${studentAnswer}"
Key concepts, marking points, or guidance for this question: "${feedbackHints || 'Evaluate based on understanding, application of concepts, clarity, and critical thinking relevant to IB Digital Society.'}"
The question is out of ${points} points.

Provide constructive feedback on the student's answer. Highlight strengths and areas for improvement.
Comment on their understanding of key concepts, use of examples (if applicable to the question and answer), discussion of stakeholders (if applicable), and links to digital technology.
Keep the feedback concise, specific, and constructive, suitable for an IB student.
Conclude with a suggested mark out of ${points} points and a brief justification for this mark.

Format your response clearly. Start the main feedback text directly.
At the end, include a line that says:
"Suggested Mark: [Your Suggested Mark Here]/${points}"

Do not include any other introductory or concluding phrases outside of this structure. Ensure the "Suggested Mark" line is the very last part of your response.
`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            // temperature: 0.6, 
            // maxOutputTokens: 512, 
        }
    };

    try {
        console.log(`Netlify Function 'generate-feedback': Sending request to Gemini for question: "${questionText}"`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text(); 
            console.error(`Gemini API request failed for feedback generation: ${response.status}:`, errorBody);
            throw new Error(`Gemini API request failed for feedback: ${response.status}. ${errorBody}`);
        }

        const data = await response.json();
        console.log("Netlify Function 'generate-feedback': Raw response object from Gemini:", JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            console.error("Unexpected response structure from Gemini API for feedback:", data);
            throw new Error('Unexpected response structure from Gemini API for feedback.');
        }

        const geminiFeedbackText = data.candidates[0].content.parts[0].text;
        console.log("Netlify Function 'generate-feedback': Feedback text from Gemini:", geminiFeedbackText);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ feedback: geminiFeedbackText.trim() }), 
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error("Netlify Function 'generate-feedback': Error processing request:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Failed to generate feedback.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};