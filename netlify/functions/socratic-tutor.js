// netlify/functions/socratic-tutor.js

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
        console.error("Netlify Function 'socratic-tutor': Gemini API key is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key not configured on the server.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    let questionText, studentCurrentAnswer, conversationHistory, latestStudentChat;

    try {
        const body = JSON.parse(event.body);
        questionText = body.questionText;
        studentCurrentAnswer = body.studentCurrentAnswer || ""; // Student's main answer to the SAQ
        conversationHistory = body.conversationHistory || []; // Array of { sender: 'user'/'ai', text: '...' }
        latestStudentChat = body.latestStudentChat || ""; // The most recent message from the student in the chat

        if (!questionText) {
            console.error("Netlify Function 'socratic-tutor': Missing questionText.");
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required field: questionText.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
        if (!latestStudentChat && conversationHistory.length === 0) {
             console.warn("Netlify Function 'socratic-tutor': No latest student chat and empty history. This might be an initial prompt.");
             // Allow it to proceed, Gemini might just ask an opening Socratic question.
        }

    } catch (e) {
        console.error("Netlify Function 'socratic-tutor': Error parsing request body:", e);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid request body.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    // Construct the conversation history for Gemini API
    // Gemini expects roles 'user' and 'model'. We map 'ai' to 'model'.
    const geminiConversationHistory = conversationHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));
    
    // Add the latest student chat as the current user message if not already the last in history
    if (latestStudentChat && (geminiConversationHistory.length === 0 || geminiConversationHistory[geminiConversationHistory.length - 1].role !== 'user' || geminiConversationHistory[geminiConversationHistory.length - 1].parts[0].text !== latestStudentChat)) {
        geminiConversationHistory.push({ role: 'user', parts: [{text: latestStudentChat}] });
    }


    const systemInstruction = `You are an IB Digital Society Socratic Tutor. Your goal is to help a student understand how to answer a specific Short Answer Question (SAQ) by guiding them with questions, rather than providing direct answers.
The original SAQ is: "${questionText}"
The student's current attempt at answering the main SAQ (if any) is: "${studentCurrentAnswer || 'No attempt yet.'}"

Your role is to:
- Analyze the student's chat message and the conversation history.
- If the student is asking for a direct answer to the SAQ, gently refuse and instead ask a probing question to guide them.
- Help them break down the original SAQ.
- Prompt them to recall relevant concepts, terms, or examples.
- Encourage them to think about different perspectives or stakeholders.
- If they seem stuck, offer a small hint or ask a simpler, related question.
- Keep your responses concise, encouraging, and focused on guiding their thought process.
- Do not provide model answers or large chunks of information.
- End your response with a question to encourage further thinking from the student.
- If the student's latest chat message seems to indicate they are ready to attempt or revise their main SAQ answer, you can gently suggest they do so.
- If the student expresses frustration or says "I don't know", try to reframe or simplify your guidance.`;

    // The full prompt includes the system instruction and the conversation history.
    // Gemini's more recent models handle multi-turn chat by passing the history in the `contents` array.
    // The system instruction can be the first 'user' message, or for some models, a dedicated 'system' role (check API docs).
    // For this setup, we'll prepend it to the user's turn for simplicity if history is empty, or ensure it's part of the context.

    const contentsForGemini = [];
    if (geminiConversationHistory.length === 0 && latestStudentChat) {
        // This is the first turn from the student to the Socratic tutor
        contentsForGemini.push({ role: 'user', parts: [{ text: `${systemInstruction}\n\nStudent's first message to Socratic Tutor: ${latestStudentChat}` }] });
    } else if (geminiConversationHistory.length > 0) {
        // Prepend system instruction to the first user message if not already contextualized
        // Or assume the model understands its role from ongoing interaction.
        // For simplicity, we'll rely on the role being established by repeated interaction or initial messages.
        // A more robust way is to use the 'system' instruction capability if available for your model version.
        // Let's add the system instruction as the first message from the 'model' if the history is only one user message.
        if(geminiConversationHistory.length === 1 && geminiConversationHistory[0].role === 'user') {
            contentsForGemini.push({ role: 'user', parts: [{text: systemInstruction}] }); // System prompt as a user turn to set context
            contentsForGemini.push(...geminiConversationHistory); // then the actual conversation
        } else {
             contentsForGemini.push({ role: 'user', parts: [{text: systemInstruction}] }); // Always provide system instruction
             contentsForGemini.push(...geminiConversationHistory);
        }
    } else {
        // First interaction, student hasn't typed anything yet (e.g. just opened the tutor)
        contentsForGemini.push({ role: 'user', parts: [{ text: systemInstruction }]});
        contentsForGemini.push({ role: 'model', parts: [{ text: "Hello! I see you're looking at the question: \"" + questionText + "\". What are your initial thoughts or where are you feeling stuck?" }]});
    }


    const requestBody = {
        contents: contentsForGemini,
        generationConfig: {
            temperature: 0.7, // Allow for some conversational variance
            maxOutputTokens: 250, // Keep responses relatively concise
        }
    };

    try {
        console.log(`Netlify Function 'socratic-tutor': Sending request to Gemini. History length: ${geminiConversationHistory.length}`);
        // console.log("Netlify Function 'socratic-tutor': Request body:", JSON.stringify(requestBody, null, 2)); // Can be very verbose

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text(); 
            console.error(`Gemini API request failed for Socratic tutor: ${response.status}:`, errorBody);
            throw new Error(`Gemini API request failed: ${response.status}. ${errorBody}`);
        }

        const data = await response.json();
        // console.log("Netlify Function 'socratic-tutor': Raw response object from Gemini:", JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            console.error("Unexpected response structure from Gemini API for Socratic tutor:", data);
            throw new Error('Unexpected response structure from Gemini API for Socratic tutor.');
        }

        const geminiTutorResponse = data.candidates[0].content.parts[0].text;
        console.log("Netlify Function 'socratic-tutor': Tutor response from Gemini:", geminiTutorResponse);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ tutorResponse: geminiTutorResponse.trim() }), 
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error("Netlify Function 'socratic-tutor': Error processing request:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Failed to get response from Socratic tutor.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};