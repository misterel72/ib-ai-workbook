import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
// Firebase imports:
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    arrayUnion, 
    increment,
    onSnapshot 
} from 'firebase/firestore';
import { 
    ChevronLeft, ChevronRight, BookOpen, CheckCircle, Award, Brain, 
    Users, Lightbulb, MessageSquare, LogOut, UserCircle, Sparkles, Mail, KeyRound, UserPlus, Menu, X, Wand2, Loader2, MessageCircleQuestion, SendHorizonal
} from 'lucide-react'; // Added MessageCircleQuestion, SendHorizonal

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDsQVBp29tQTsE5VBmTh1ZW5BGfKEbN6rM", 
  authDomain: "ib-ds-ai-workbook.firebaseapp.com",
  projectId: "ib-ds-ai-workbook",
  storageBucket: "ib-ds-ai-workbook.firebasestorage.app",
  messagingSenderId: "826285458174",
  appId: "1:826285458174:web:cf1032b62fc027908ddbaf",
  measurementId: "G-ZVCWPCS21V"
};

// Initialize Firebase
let app;
let auth;
let db;
let analytics;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);
    console.log("Firebase Initialized SUCCESSFULLY in WrappedApp:", { app, auth, db, analytics }); 
} catch (error) {
    console.error("Firebase initialization FAILED in WrappedApp:", error); 
}

// --- Context for Auth and User Data ---
const AuthContext = createContext();
const UserDataContext = createContext();

export function AuthProvider({ children }) {
  console.log("AuthProvider rendering..."); 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!auth) {
        console.error("Firebase Auth is not initialized in AuthProvider.");
        setLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("AuthProvider onAuthStateChanged, currentUser:", currentUser); 
      setAuthError(null); 
      if (currentUser) {
        setUser(currentUser);
        if (db) {
            const userDocRef = doc(db, `users/${currentUser.uid}`);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
              try {
                console.log("AuthProvider: User document does not exist, creating for UID:", currentUser.uid); 
                await setDoc(userDocRef, {
                  uid: currentUser.uid,
                  email: currentUser.email, 
                  displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Student', 
                  points: 0,
                  completedLessons: [],
                  completedQuizzes: [],
                  badges: [],
                  createdAt: new Date(),
                  lastLogin: new Date()
                });
                console.log("AuthProvider: User document CREATED for UID:", currentUser.uid); 
              } catch (e) {
                console.error("AuthProvider: Error creating user document:", e); 
                setAuthError("Failed to create user profile.");
              }
            } else {
              try {
                await updateDoc(userDocRef, { lastLogin: new Date() });
              } catch (e) {
                console.error("AuthProvider: Error updating last login:", e);
              }
              console.log("AuthProvider: User document already exists for UID:", currentUser.uid); 
            }
        } else {
            console.error("AuthProvider: Firestore 'db' is not initialized."); 
            setAuthError("User profile service unavailable.");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); 

  const signUpWithEmail = async (email, password, displayName) => {
    console.log("AuthProvider: signUpWithEmail called for:", email);
    if (!auth) {
        console.error("Firebase Auth is not initialized. Cannot sign up.");
        setAuthError("Authentication service not ready.");
        return null;
    }
    setLoading(true);
    setAuthError(null);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("AuthProvider: User CREATED with email/password:", userCredential.user);
        if (displayName && userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
        }
        return userCredential.user;
    } catch (error) {
        console.error("AuthProvider: Error signing up:", error);
        setAuthError(error.message); 
        setLoading(false);
        return null;
    }
  };

  const logInWithEmail = async (email, password) => {
    console.log("AuthProvider: logInWithEmail called for:", email);
    if (!auth) {
        console.error("Firebase Auth is not initialized. Cannot sign in.");
        setAuthError("Authentication service not ready.");
        return null;
    }
    setLoading(true);
    setAuthError(null);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("AuthProvider: User SIGNED IN with email/password:", userCredential.user);
        return userCredential.user;
    } catch (error) {
        console.error("AuthProvider: Error signing in:", error);
        setAuthError(error.message); 
        setLoading(false);
        return null;
    }
  };

  const appSignOut = async () => {
    console.log("AuthProvider: appSignOut called"); 
    if (!auth) {
        console.error("Firebase Auth is not initialized. Cannot sign out.");
        return;
    }
    setAuthError(null);
    try {
      await signOut(auth);
      console.log("AuthProvider: Sign-out successful."); 
    } catch (error) {
      console.error("AuthProvider: Error signing out:", error); 
      setAuthError(error.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signUpWithEmail, logInWithEmail, appSignOut, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function UserDataProvider({ children }) {
  console.log("UserDataProvider rendering..."); 
  const { user } = useContext(AuthContext); 
  const [userData, setUserData] = useState(null);
  const [loadingData, setLoadingData] = useState(true); 

  useEffect(() => {
    console.log("UserDataProvider useEffect triggered. User:", user); 
    if (user && db) {
      setLoadingData(true);
      console.log("UserDataProvider: User exists and db initialized. Setting up snapshot for UID:", user.uid); 
      const userDocRef = doc(db, `users/${user.uid}`);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        console.log("UserDataProvider onSnapshot: Data received. Exists:", docSnap.exists()); 
        if (docSnap.exists()) {
          setUserData(docSnap.data());
          console.log("UserDataProvider onSnapshot: User data set:", docSnap.data()); 
        } else {
          console.warn("UserDataProvider onSnapshot: User document does not exist for UID:", user.uid, "This might be okay if AuthProvider is creating it.");
          setUserData(null); 
        }
        setLoadingData(false);
      }, (error) => {
        console.error("UserDataProvider: Error fetching user data with onSnapshot:", error); 
        setLoadingData(false);
      });
      return () => {
        console.log("UserDataProvider: Unsubscribing from user data snapshot for UID:", user.uid); 
        unsubscribe();
      }
    } else if (!user) {
      console.log("UserDataProvider: No user. Setting userData to null and loadingData to false."); 
      setUserData(null);
      setLoadingData(false); 
    } else if (!db) {
        console.error("UserDataProvider: Firestore 'db' is not initialized. Cannot fetch user data."); 
        setLoadingData(false);
    }
  }, [user]); 

  const markLessonCompleted = async (lessonId, pointsAwarded) => {
    if (user && db && userData && (!userData.completedLessons || !userData.completedLessons.includes(lessonId))) { 
      const userDocRef = doc(db, `users/${user.uid}`);
      try {
        await updateDoc(userDocRef, {
          completedLessons: arrayUnion(lessonId),
          points: increment(pointsAwarded)
        });
      } catch (e) {
        console.error("UserDataProvider: Error marking lesson completed:", e);
      }
    }
  };

  const markQuizCompleted = async (quizId, scoreData, pointsAwarded) => {
     if (user && db && userData && (!userData.completedQuizzes || !userData.completedQuizzes.find(q => q.quizId === quizId))) { 
      const userDocRef = doc(db, `users/${user.uid}`);
      try {
        await updateDoc(userDocRef, {
          completedQuizzes: arrayUnion({ quizId, score: scoreData, date: new Date() }),
          points: increment(pointsAwarded)
        });
      } catch (e) {
        console.error("UserDataProvider: Error marking quiz completed:", e);
      }
    }
  };
  
  const addBadge = async (badgeName) => {
    if (user && db && userData && (!userData.badges || !userData.badges.includes(badgeName))) { 
        const userDocRef = doc(db, `users/${user.uid}`);
        try {
            await updateDoc(userDocRef, {
                badges: arrayUnion(badgeName)
            });
        } catch (e) {
            console.error("UserDataProvider: Error adding badge:", e);
        }
    }
  };

  return (
    <UserDataContext.Provider value={{ userData, loadingData, markLessonCompleted, markQuizCompleted, addBadge }}>
      {children}
    </UserDataContext.Provider>
  );
}

function AuthForm() {
    console.log("AuthForm rendering...");
    const [isSignUp, setIsSignUp] = useState(true); 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState(''); 
    const [error, setError] = useState(''); 
    const [isLoading, setIsLoading] = useState(false);

    const { signUpWithEmail, logInWithEmail, authError: contextAuthError, setAuthError } = useContext(AuthContext);

    useEffect(() => { 
        if (contextAuthError) {
            setError(contextAuthError);
        }
    }, [contextAuthError]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(''); 
        if (setAuthError) setAuthError(null); 

        if (isSignUp) {
            if (password.length < 6) {
                setError("Password should be at least 6 characters.");
                setIsLoading(false);
                return;
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match!");
                setIsLoading(false);
                return;
            }
            if (!displayName.trim()) {
                setError("Display name is required for sign up.");
                setIsLoading(false);
                return;
            }
            await signUpWithEmail(email, password, displayName);
        } else {
            await logInWithEmail(email, password);
        }
        setIsLoading(false); 
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 text-white">
            <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 rounded-xl shadow-2xl">
                <div className="text-center">
                    <Sparkles className="w-16 h-16 mx-auto text-sky-400 mb-4" />
                    <h1 className="text-3xl font-bold text-white">
                        {isSignUp ? 'Create Your Account' : 'Welcome Back!'}
                    </h1>
                    <p className="text-slate-400 mt-2">
                        {isSignUp ? 'to start your IB AI Learning Journey' : 'Sign in to continue your learning'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {isSignUp && (
                        <div>
                            <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-1">Display Name</label>
                            <div className="relative">
                                <UserPlus className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    id="displayName"
                                    name="displayName"
                                    type="text"
                                    required
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-slate-700 text-white"
                                    placeholder="Your Name or Nickname"
                                />
                            </div>
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-slate-700 text-white"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                         <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-slate-700 text-white"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {isSignUp && (
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-slate-700 text-white"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    )}

                    {error && <p className="mt-2 text-sm text-red-400 text-center bg-red-900/30 p-2 rounded-md">{error}</p>}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center mt-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-60"
                        >
                            {isLoading ? (
                                <Sparkles className="animate-spin h-5 w-5 text-white" /> 
                            ) : (isSignUp ? 'Create Account' : 'Sign In')}
                        </button>
                    </div>
                </form>

                <p className="mt-8 text-center text-sm text-slate-400">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                        onClick={() => { 
                            setIsSignUp(!isSignUp); 
                            setError(''); 
                            if(setAuthError) setAuthError(null); 
                        }}
                        className="font-medium text-sky-400 hover:text-sky-300 focus:outline-none"
                    >
                        {isSignUp ? 'Sign In here' : 'Sign Up here'}
                    </button>
                </p>
            </div>
        </div>
    );
}

function LiveQuizGenerator() {
    console.log("LiveQuizGenerator rendering..."); 
    const [topic, setTopic] = useState('');
    const [generatedQuiz, setGeneratedQuiz] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentView, setCurrentView] = useState('form'); 

    const [numQuestions, setNumQuestions] = useState(3); 
    const [questionTypePref, setQuestionTypePref] = useState('mix'); 

    const handleGenerateQuiz = async () => { 
        const quizTopic = topic; 
        if (!quizTopic.trim()) {
            setError('Please enter a topic for the quiz.');
            return;
        }
        if (numQuestions <= 0 || numQuestions > 10) { 
            setError('Please enter a number of questions between 1 and 10.');
            return;
        }

        setIsLoading(true);
        setError('');
        setGeneratedQuiz(null); 

        let reqNumMCQs = 0;
        let reqNumSAQs = 0;

        if (questionTypePref === 'mcq_only') {
            reqNumMCQs = numQuestions;
        } else if (questionTypePref === 'saq_only') {
            reqNumSAQs = numQuestions; 
        } else { 
            reqNumMCQs = Math.ceil(numQuestions / 2);
            reqNumSAQs = Math.floor(numQuestions / 2);
            if (reqNumMCQs + reqNumSAQs < numQuestions && numQuestions > 0) { 
                reqNumMCQs++; 
            }
             if (numQuestions === 1 && reqNumSAQs === 0 && reqNumMCQs === 0) reqNumMCQs = 1; 
             else if (numQuestions === 1 && reqNumMCQs === 0 && reqNumSAQs === 0) reqNumSAQs = 1;
        }
        
        if (numQuestions > 0 && reqNumMCQs === 0 && reqNumSAQs === 0) {
             reqNumMCQs = numQuestions;
        }

        console.log(`LiveQuizGenerator: Requesting ${reqNumMCQs} MCQs and ${reqNumSAQs} SAQs for topic: ${quizTopic}`);

        try {
            const response = await fetch('/.netlify/functions/generate-quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topic: quizTopic, numMCQs: reqNumMCQs, numSAQs: reqNumSAQs }),
            });

            if (!response.ok) {
                let errData;
                try {
                    errData = await response.json();
                } catch(e) {
                    errData = { error: await response.text() || `Quiz generation failed with status: ${response.status}`};
                }
                throw new Error(errData.error || `Quiz generation failed with status: ${response.status}`);
            }

            const data = await response.json();
            console.log("LiveQuizGenerator: Received quiz data from Netlify function:", data);
            if (data.quiz && data.quiz.questions && data.quiz.questions.length > 0) {
                const questionsWithIds = data.quiz.questions.map((q, index) => ({
                    ...q,
                    id: q.id || `live-q-${quizTopic.replace(/\s+/g, '-')}-${index}` 
                }));
                setGeneratedQuiz({ ...data.quiz, questions: questionsWithIds, title: `Live Quiz: ${quizTopic}` }); 
                setCurrentView('quiz'); 
            } else {
                throw new Error('Generated quiz data is not in the expected format or is empty. Gemini might not have been able to fulfill the request for the given topic and question types/numbers.');
            }
        } catch (err) {
            console.error("Error generating live quiz:", err);
            setError(err.message || 'Failed to generate quiz. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    if (currentView === 'quiz' && generatedQuiz) {
        return (
            <div className="bg-slate-700 p-6 rounded-xl shadow-lg mt-8">
                 <QuizView 
                    quiz={generatedQuiz} 
                    onBackToLessons={() => { 
                        setGeneratedQuiz(null);
                        setCurrentView('form');
                    }} 
                    isLiveQuiz={true} 
                    moduleTitle={`Live Quiz: ${topic}`} 
                 />
            </div>
        );
    }

    return (
        <div className="bg-slate-700 p-6 rounded-xl shadow-lg mt-8">
            <h3 className="text-2xl font-semibold text-sky-300 mb-1 flex items-center">
                <Wand2 size={28} className="mr-3 text-purple-400" />
                Live Quiz Generator (Ad-hoc)
            </h3>
            <p className="text-sm text-slate-400 mb-4">Enter any topic, choose question types and number, then generate a practice quiz!</p>
            
            <div className="space-y-4 mb-4">
                <div>
                    <label htmlFor="quizTopic" className="block text-sm font-medium text-slate-300 mb-1">Topic</label>
                    <input
                        id="quizTopic"
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., Algorithmic Bias, Data Privacy"
                        className="w-full p-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label htmlFor="questionType" className="block text-sm font-medium text-slate-300 mb-1">Question Types</label>
                        <select
                            id="questionType"
                            value={questionTypePref}
                            onChange={(e) => setQuestionTypePref(e.target.value)}
                            className="w-full p-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value="mix">Mixed (MCQ & Short Answer)</option>
                            <option value="mcq_only">Multiple Choice Only</option>
                            <option value="saq_only">Short Answer Only</option>
                        </select>
                    </div>
                    <div className="sm:w-1/3">
                        <label htmlFor="numQuestions" className="block text-sm font-medium text-slate-300 mb-1">Number of Questions</label>
                        <input
                            id="numQuestions"
                            type="number"
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Math.max(1, Math.min(10, parseInt(e.target.value, 10))) || 1)} 
                            min="1"
                            max="10" 
                            className="w-full p-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                    </div>
                </div>
            </div>
            
            <button
                onClick={handleGenerateQuiz}
                disabled={isLoading || !topic.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Wand2 size={20} className="mr-2" />}
                {isLoading ? 'Generating...' : 'Generate Quiz'}
            </button>
            {error && <p className="mt-4 text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
        </div>
    );
}


const modulesData = [
  {
    id: 'intro-ai',
    title: 'Introduction to Artificial Intelligence',
    description: 'Understand the fundamental concepts of AI, its types, and its evolution. Features a dynamically generated quiz.',
    icon: Brain,
    quizType: 'live', 
    quizTopic: 'The Core Concepts and Types of Artificial Intelligence', 
    lessons: [
      { id: 'intro-ai-what-is-ai', title: 'What is AI?', type: 'theory', points: 10, content: `
        <p>Artificial Intelligence (AI) involves creating systems or agents that can perform tasks traditionally requiring human intelligence. This includes abilities like learning, problem-solving, decision-making, and understanding language.</p>
        <p>Think of AI as a broad field encompassing many different approaches and technologies. The core idea is to simulate intelligent behaviour in machines.</p>
        <h3 class="text-xl font-semibold mt-4 mb-2 text-sky-400">Key Characteristics:</h3>
        <ul class="list-disc list-inside space-y-1">
          <li><strong>Adaptation:</strong> AI systems can learn and adapt to new information or changing environments.</li>
          <li><strong>Autonomy:</strong> They can operate without direct human intervention for certain tasks.</li>
          <li><strong>Perception:</strong> Some AI can interpret sensory data (like images or sound).</li>
          <li><strong>Reasoning:</strong> AI can draw logical conclusions or make predictions based on data.</li>
        </ul>
      `},
      { id: 'intro-ai-types', title: 'Types of AI', type: 'theory', points: 15, content: `
        <p>AI can be broadly categorized based on its capabilities:</p>
        <h3 class="text-xl font-semibold mt-4 mb-2 text-sky-400">1. Weak/Narrow AI (Artificial Narrow Intelligence - ANI)</h3>
        <p>This is the most common type of AI we see today. It's designed and trained for a specific task. While it might seem intelligent in that domain, it cannot perform outside its designated scope.</p>
        <p><strong>Examples:</strong> Virtual assistants (Siri, Alexa), recommendation engines (Netflix, Spotify), self-driving car components, image recognition software, spam filters.</p>
        
        <h3 class="text-xl font-semibold mt-4 mb-2 text-sky-400">2. Strong AI / Artificial General Intelligence (AGI)</h3>
        <p>AGI is a hypothetical type of AI that possesses the ability to understand, learn, and apply knowledge across a wide range of tasks at a human level of intelligence. It would be conscious, self-aware, and capable of solving complex problems it wasn't specifically programmed for.</p>
        <p><strong>Status:</strong> AGI does not currently exist. It's a major goal for many AI researchers.</p>

        <h3 class="text-xl font-semibold mt-4 mb-2 text-sky-400">3. Super AI (Artificial Superintelligence - ASI)</h3>
        <p>ASI is another hypothetical form of AI that would surpass human intelligence and ability across virtually all fields. The implications of ASI are profound and widely debated.</p>
        <p><strong>Status:</strong> ASI is purely theoretical at this point.</p>

        <h3 class="text-xl font-semibold mt-4 mb-2 text-sky-400">Domain-Specific AI</h3>
        <p>This is a subset of Narrow AI that excels in a particular area, sometimes even surpassing human capabilities within that specific domain. For example, AI systems for medical diagnosis (like detecting cancer from scans) or AI playing complex games (like AlphaGo).</p>
      `},
    ]
  },
  {
    id: 'ml-basics',
    title: 'Machine Learning Basics',
    description: 'Explore the fundamentals of machine learning, including supervised, unsupervised, and reinforcement learning.',
    icon: Lightbulb, 
    lessons: [ 
        { id: 'ml-what-is-ml', title: 'What is Machine Learning?', type: 'theory', points: 10, content: `<p>Machine learning is a subset of AI...</p>`},
    ],
    quiz: { 
      id: 'quiz-ml-basics',
      title: 'ML Basics Quiz',
      points: 40,
      questions: [
        { id: 'mlq1', type: 'mcq', text: 'Which type of ML uses labeled data?', options: ['Supervised', 'Unsupervised', 'Reinforced'], correctAnswer: 'Supervised', points: 10, feedback: 'Supervised learning trains on data with known outcomes.'}
      ]
    }
  }
];

function Header({ currentModuleTitle }) {
  const { user, appSignOut } = useContext(AuthContext);
  const { userData, loadingData } = useContext(UserDataContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userDisplayName = userData?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <header className="bg-slate-800 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center">
        <Sparkles className="h-8 w-8 text-sky-400 mr-2 md:mr-3" />
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">IB AI Workbook</h1>
        {currentModuleTitle && <span className="ml-2 md:ml-4 text-xs sm:text-sm text-slate-400 hidden md:inline truncate">| {currentModuleTitle}</span>}
      </div>

      {user && (
        <div className="hidden md:flex items-center space-x-4">
           <div className="text-sm text-slate-300 truncate max-w-[150px] lg:max-w-[250px]" title={user.email}>
             {userDisplayName}
           </div>
          { !loadingData && userData && (
            <div className="flex items-center" title="Your Points">
              <Award className="h-5 w-5 text-yellow-400 mr-1" />
              <span className="font-semibold">{userData.points || 0}</span>
            </div>
          )}
          <button 
            onClick={appSignOut} 
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-lg text-sm flex items-center"
            title="Sign Out"
          >
            <LogOut size={16} className="mr-1 md:mr-2" /> Sign Out
          </button>
        </div>
      )}
      
      {user && (
        <div className="md:hidden">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-300 hover:text-white focus:outline-none">
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      )}

      {user && isMobileMenuOpen && (
        <div className="md:hidden absolute top-full right-0 mt-1 w-48 bg-slate-700 rounded-md shadow-lg p-2 z-50 border border-slate-600">
          <div className="text-sm text-slate-200 px-2 py-1 mb-1 truncate" title={user.email}>
            {userDisplayName}
          </div>
          { !loadingData && userData && (
            <div className="flex items-center px-2 py-1 mb-1" title="Your Points">
              <Award className="h-5 w-5 text-yellow-400 mr-2" />
              <span className="font-semibold">{userData.points || 0} Points</span>
            </div>
          )}
          <button 
            onClick={() => { appSignOut(); setIsMobileMenuOpen(false); }} 
            className="w-full text-left bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-md text-sm flex items-center"
          >
            <LogOut size={16} className="mr-2" /> Sign Out
          </button>
        </div>
      )}
    </header>
  );
}

function Sidebar({ modules, selectedModule, onSelectModule, onShowDashboard, isOpen, setIsOpen }) {
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}
      <aside 
        className={`bg-slate-800 text-white p-4 space-y-2 transform transition-transform duration-300 ease-in-out
                   fixed md:sticky md:top-[72px] md:translate-x-0 h-full md:h-auto md:min-h-[calc(100vh-72px)] z-40
                   w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:flex-shrink-0`}
      >
         <div className="flex justify-end md:hidden mb-2">
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
            </button>
        </div>
        <button
          onClick={() => { onShowDashboard(); setIsOpen(false); }}
          className={`w-full flex items-center p-3 rounded-lg hover:bg-slate-700 transition-colors ${!selectedModule ? 'bg-sky-600' : ''}`}
        >
          <BookOpen size={20} className="mr-3" /> Dashboard
        </button>
        <h2 className="text-sm font-semibold text-slate-400 uppercase pt-2">Modules</h2>
        {modules.map(module => {
          const Icon = module.icon || Lightbulb;
          return (
            <button
              key={module.id}
              onClick={() => { onSelectModule(module); setIsOpen(false); }}
              className={`w-full flex items-center p-3 rounded-lg hover:bg-slate-700 transition-colors ${selectedModule?.id === module.id ? 'bg-sky-600' : ''}`}
            >
              <Icon size={20} className="mr-3" /> {module.title}
            </button>
          );
        })}
      </aside>
    </>
  );
}

function Dashboard({ modules, onSelectModule, userData }) {
  console.log("Dashboard rendering. UserData:", userData); 
  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-sky-400">Welcome to the AI Workbook!</h2>
      <p className="text-slate-300 mb-8">Select a module to begin your learning journey or try generating a live quiz below.</p>
      
      {userData && (
        <div className="mb-8 p-4 md:p-6 bg-slate-700 rounded-xl shadow-lg">
          <h3 className="text-xl md:text-2xl font-semibold text-sky-300 mb-4">Your Progress</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-600 p-4 rounded-lg text-center">
              <Award className="h-8 md:h-10 w-8 md:w-10 text-yellow-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-bold">{userData.points || 0}</p>
              <p className="text-slate-300 text-sm">Points Earned</p>
            </div>
            <div className="bg-slate-600 p-4 rounded-lg text-center">
              <BookOpen className="h-8 md:h-10 w-8 md:w-10 text-sky-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-bold">{userData.completedLessons?.length || 0}</p>
              <p className="text-slate-300 text-sm">Lessons Completed</p>
            </div>
            <div className="bg-slate-600 p-4 rounded-lg text-center">
              <CheckCircle className="h-8 md:h-10 w-8 md:w-10 text-green-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-bold">{userData.completedQuizzes?.length || 0}</p>
              <p className="text-slate-300 text-sm">Quizzes Mastered</p>
            </div>
          </div>
           {userData.badges && userData.badges.length > 0 && (
            <div className="mt-6">
                <h4 className="text-lg md:text-xl font-semibold text-sky-300 mb-2">Your Badges:</h4>
                <div className="flex flex-wrap gap-2">
                    {userData.badges.map(badge => (
                        <span key={badge} className="bg-yellow-500 text-slate-900 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">{badge}</span>
                    ))}
                </div>
            </div>
           )}
        </div>
      )}

      <LiveQuizGenerator />

      <h3 className="text-xl md:text-2xl font-semibold my-6 text-sky-300">Available Modules</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {modules.map(module => {
          const Icon = module.icon || Lightbulb;
          const isModuleCompleted = !module.quizType && userData?.completedQuizzes?.some(q => q.quizId === module.quiz.id); 
          return (
            <div
              key={module.id}
              className={`bg-slate-700 p-4 md:p-6 rounded-xl shadow-lg hover:shadow-sky-500/30 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer relative ${isModuleCompleted ? 'border-2 border-green-500' : 'border-2 border-slate-600'}`}
              onClick={() => onSelectModule(module)}
            >
              <Icon size={32} md:size={36} className="mb-3 text-sky-400" />
              <h4 className="text-lg md:text-xl font-semibold mb-2 text-sky-300">{module.title}</h4>
              <p className="text-sm text-slate-400 mb-4">{module.description}</p>
              <button className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                {isModuleCompleted ? "Review Quiz" : (module.quizType === 'live' ? "Take Live Quiz" : "Start Module")}
              </button>
              {isModuleCompleted && <CheckCircle className="absolute top-2 right-2 md:top-3 md:right-3 h-5 w-5 md:h-6 md:w-6 text-green-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleView({ module, onGenerateLiveQuiz }) { 
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false); 
  const { userData, markLessonCompleted } = useContext(UserDataContext);

  useEffect(() => { 
    setCurrentLessonIndex(0);
    setShowQuiz(false);
  }, [module]);

  const currentLesson = module.lessons[currentLessonIndex];

  const handleNextLesson = () => {
    if (userData && (!userData.completedLessons || !userData.completedLessons.includes(currentLesson.id))) {
        markLessonCompleted(currentLesson.id, currentLesson.points);
    }
    if (currentLessonIndex < module.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else {
      if (module.quizType === 'live' && module.quizTopic) {
          console.log("ModuleView: Triggering live quiz generation for topic:", module.quizTopic);
          onGenerateLiveQuiz(module.quizTopic, module.id, module.title); 
      } else if (module.quiz) { 
          setShowQuiz(true); 
      } else {
          console.log("ModuleView: No quiz defined for this module or not a live quiz type.");
      }
    }
  };

  const handlePrevLesson = () => {
    if (showQuiz) setShowQuiz(false); 
    else if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };
  
  const isLessonCompleted = userData?.completedLessons?.includes(currentLesson.id);

  if (showQuiz && module.quiz && module.quizType !== 'live') {
    return <QuizView quiz={module.quiz} onBackToLessons={() => setShowQuiz(false)} moduleTitle={module.title} moduleId={module.id} />;
  }

  const lessonTypeIcons = {
    theory: <Brain size={24} className="mr-2 text-sky-400" />,
    realWorld: <Users size={24} className="mr-2 text-green-400" />,
    stakeholders: <MessageSquare size={24} className="mr-2 text-yellow-400" />,
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl md:text-3xl font-bold text-sky-400">{module.title}</h2>
        <span className="text-sm text-slate-400">Lesson {currentLessonIndex + 1} of {module.lessons.length}</span>
      </div>
      <div className="bg-slate-700 p-4 md:p-6 rounded-xl shadow-lg mb-6">
        <div className="flex items-center mb-4">
            {lessonTypeIcons[currentLesson.type] || <Lightbulb size={24} className="mr-2 text-purple-400" />}
            <h3 className="text-xl md:text-2xl font-semibold text-sky-300">{currentLesson.title}</h3>
            {isLessonCompleted && <CheckCircle size={20} className="ml-2 text-green-500" title="Lesson Completed!" />}
        </div>
        <div className="prose prose-slate prose-invert max-w-none text-slate-300" dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
        <p className="text-sm text-yellow-400 mt-4">Completing this lesson awards {currentLesson.points} points.</p>
      </div>
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevLesson}
          disabled={currentLessonIndex === 0}
          className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <ChevronLeft size={20} className="mr-1" /> Previous
        </button>
        <button
          onClick={handleNextLesson}
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center text-sm"
        >
          {currentLessonIndex < module.lessons.length - 1 ? 'Next Lesson' : (module.quizType === 'live' ? 'Generate & Take Quiz' : (module.quiz ? 'Go to Quiz' : 'Finish Module'))} 
          <ChevronRight size={20} className="ml-1" />
        </button>
      </div>
    </div>
  );
}

// --- Socratic Tutor Modal ---
function SocraticTutorModal({ isOpen, onClose, questionText, studentAnswer, onNewAnswer }) {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [tutorError, setTutorError] = useState('');
    const chatEndRef = React.useRef(null);

    useEffect(() => { // Scroll to bottom of chat
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => { // Reset messages when modal opens with a new question context
        if (isOpen) {
            setMessages([{ sender: 'ai', text: "Hello! I'm here to help you think through this question. What are your initial thoughts, or where are you feeling stuck?" }]);
            setUserInput('');
            setTutorError('');
        }
    }, [isOpen, questionText]);


    const handleSendMessage = async () => {
        if (!userInput.trim()) return;
        const newMessages = [...messages, { sender: 'user', text: userInput }];
        setMessages(newMessages);
        const currentInput = userInput;
        setUserInput('');
        setIsLoading(true);
        setTutorError('');

        try {
            const response = await fetch('/.netlify/functions/socratic-tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionText,
                    studentCurrentAnswer: studentAnswer, // Send the main answer from QuizView
                    conversationHistory: newMessages, // Send current chat history
                    latestStudentChat: currentInput // Send the latest student message specifically
                }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Socratic tutor request failed: ${response.statusText}`);
            }
            const data = await response.json();
            setMessages(prev => [...prev, { sender: 'ai', text: data.tutorResponse }]);
        } catch (err) {
            console.error("Error with Socratic Tutor:", err);
            setTutorError(err.message || "Sorry, I encountered an issue. Please try again.");
            setMessages(prev => [...prev, {sender: 'ai', text: "My apologies, I'm having a little trouble right now. Please try again in a moment."}]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col text-white">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-sky-400 flex items-center">
                        <MessageCircleQuestion size={24} className="mr-2" /> AI Socratic Tutor
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <p className="text-sm text-slate-400 mb-1">Question:</p>
                <p className="text-sm bg-slate-700 p-2 rounded mb-3 italic">{questionText}</p>
                
                <div className="flex-grow overflow-y-auto mb-4 space-y-3 pr-2">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-700'}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} /> {/* For auto-scrolling */}
                </div>

                {tutorError && <p className="text-sm text-red-400 mb-2">{tutorError}</p>}

                <div className="mt-auto flex gap-2">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                        placeholder="Ask a question or share your thoughts..."
                        className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !userInput.trim()}
                        className="bg-sky-500 hover:bg-sky-600 text-white font-semibold p-3 rounded-lg flex items-center justify-center disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <SendHorizonal size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
}


function QuizView({ quiz, onBackToLessons, moduleTitle, moduleId, isLiveQuiz = false, isGenerating = false }) { 
  console.log(`QuizView rendering. isLiveQuiz: ${isLiveQuiz}, Quiz title: ${quiz?.title}, isGenerating: ${isGenerating}`);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [feedback, setFeedback] = useState({}); 
  const [shortAnswerLoading, setShortAnswerLoading] = useState(false);
  const { userData, markQuizCompleted, addBadge } = useContext(UserDataContext);

  // Socratic Tutor State
  const [showSocraticTutor, setShowSocraticTutor] = useState(false);
  const [socraticQuestionContext, setSocraticQuestionContext] = useState(null);


  useEffect(() => {
      console.log("QuizView useEffect: Resetting state due to new quiz.", quiz?.title); 
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowResults(false);
      setFeedback({});
      setShowSocraticTutor(false); // Close tutor if quiz changes
  }, [quiz]);

  if (isGenerating) {
      return (
          <div className="p-6 text-slate-300 flex flex-col items-center justify-center min-h-[calc(100vh-150px)]"> 
              <Loader2 className="animate-spin h-12 w-12 text-sky-400 mb-4" />
              Generating your live quiz on "{moduleTitle || quiz?.title || 'the selected topic'}"... Please wait.
          </div>
      );
  }
  
  const currentQuestion = quiz?.questions?.[currentQuestionIndex]; 
  const questionKey = currentQuestion?.id || `q-${currentQuestionIndex}`; // Use currentQuestionIndex if id is missing

  const handleAnswer = (answer) => { // Simplified: questionId is derived from currentQuestionIndex
    setAnswers(prev => ({ ...prev, [questionKey]: answer }));
    if (currentQuestion?.type === 'mcq' && currentQuestion.explanation) { 
        setFeedback(prev => ({
            ...prev,
            [questionKey]: answer === currentQuestion.correctAnswer ? `Correct! ${currentQuestion.explanation}` : `Incorrect. The correct answer is ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`
        }));
    }
  };

  const handleShortAnswerSubmit = async () => { // Simplified: questionId is from currentQuestion
    if (!answers[questionKey] || answers[questionKey].trim() === "") {
        setFeedback(prev => ({...prev, [questionKey]: "Please enter an answer."}));
        return;
    }
    setShortAnswerLoading(true);
    setFeedback(prev => ({...prev, [questionKey]: "Generating feedback..."}));

    try {
        console.log("QuizView: Submitting short answer for feedback. Question:", currentQuestion?.text, "Answer:", answers[questionKey]); 
        const response = await fetch('/.netlify/functions/generate-feedback', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionText: currentQuestion?.text,
                studentAnswer: answers[questionKey],
                feedbackHints: currentQuestion?.feedbackHints || 'Evaluate based on general IB Digital Society assessment criteria for understanding, application, and critical thinking.',
                points: currentQuestion?.points || 10 
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Feedback generation failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log("QuizView: Feedback received:", result.feedback); 
        setFeedback(prev => ({ ...prev, [questionKey]: result.feedback }));

    } catch (error) {
        console.error("Error generating feedback:", error);
        setFeedback(prev => ({ ...prev, [questionKey]: `Error generating feedback: ${error.message}. Please try again.` }));
    } finally {
        setShortAnswerLoading(false);
    }
  };

  const calculateScore = () => {
    let score = 0;
    quiz?.questions?.forEach((q, idx) => { 
      const qKey = q.id || `q-${idx}`;
      const questionPoints = q.points || (q.type === 'mcq' ? 10 : (q.type === 'saq' ? 20 : 0)); 

      if (q.type === 'mcq') {
        if (answers[qKey] === q.correctAnswer) {
          score += questionPoints; 
        }
      } else if (q.type === 'saq') { 
        const questionFeedback = feedback[qKey];
        if (questionFeedback && typeof questionFeedback === 'string') {
            const match = questionFeedback.match(/Suggested Mark: (\d+)\/(\d+)/);
            if (match && parseInt(match[2]) === questionPoints) { 
                score += parseInt(match[1]);
            } else if (answers[qKey] && answers[qKey].length > 10) { 
                 score += Math.floor(questionPoints / 2); 
            }
        } else if (answers[qKey] && answers[qKey].length > 10) {
             score += Math.floor(questionPoints / 2);
        }
      }
    });
    return score;
  };

  const handleSubmitQuiz = () => {
    console.log("QuizView: handleSubmitQuiz called."); 
    const finalScore = calculateScore();
    const totalPossibleScore = quiz?.questions?.reduce((sum, q) => sum + (q.points || (q.type === 'mcq' ? 10 : (q.type === 'saq' ? 20 : 0))), 0) || 0; 
    
    if (!isLiveQuiz && quiz.id && modulesData.find(m => m.quiz?.id === quiz.id)?.quiz?.points) { 
        const predefinedQuizOverallPoints = modulesData.find(m => m.quiz.id === quiz.id).quiz.points;
        const scoreDataToStore = { score: finalScore, total: totalPossibleScore };
        const pointsForCompletion = predefinedQuizOverallPoints + finalScore; 
        markQuizCompleted(quiz.id, scoreDataToStore, pointsForCompletion);

        if (totalPossibleScore > 0 && (finalScore / totalPossibleScore >= 0.8)) {
            addBadge(`${moduleTitle || quiz.title} Master`);
        }
        const completedQuizIds = userData?.completedQuizzes?.map(q => q.quizId) || [];
        const allPredefinedQuizzes = modulesData.filter(m => m.quiz && m.quizType !== 'live');
        const allPredefinedQuizzesDone = allPredefinedQuizzes.every(m => completedQuizIds.includes(m.quiz.id) || m.quiz.id === quiz.id);


        if (allPredefinedQuizzesDone && !userData?.badges?.includes("AI Workbook Champion")) {
            addBadge("AI Workbook Champion");
        }
    }
    setShowResults(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (quiz?.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowSocraticTutor(false); // Close tutor when moving to next question
    } else {
      handleSubmitQuiz();
    }
  };

  const openSocraticTutor = () => {
      setSocraticQuestionContext({
          questionText: currentQuestion.text,
          studentAnswer: answers[questionKey] || ""
      });
      setShowSocraticTutor(true);
  };
  
  if (showResults) {
    // ... (showResults JSX, ensure it uses questionKey for answers and feedback)
    // ... (Make sure this JSX is complete from previous versions)
    const finalScoreData = {score: calculateScore(), total: quiz?.questions?.reduce((sum, q) => sum + (q.points || (q.type === 'mcq' ? 10 : (q.type === 'saq' ? 20 : 0))), 0) || 0};
    const predefinedQuizInfo = !isLiveQuiz && modulesData.find(m => m.quiz?.id === quiz.id);
    const predefinedQuizOverallPoints = predefinedQuizInfo?.quiz?.points || 0;
    return (
      <div className="p-4 md:p-6 bg-slate-700 rounded-xl shadow-lg text-center">
        <h3 className="text-2xl md:text-3xl font-bold text-sky-400 mb-4">Quiz Results: {quiz?.title}</h3>
        <Award size={48} md:size={64} className="mx-auto text-yellow-400 mb-4" />
        <p className="text-xl md:text-2xl text-white mb-2">
          Your Score: <span className="font-bold text-green-400">{finalScoreData.score}</span> / {finalScoreData.total}
        </p>
        {!isLiveQuiz && predefinedQuizOverallPoints > 0 && <p className="text-slate-300 mb-6 text-sm">You've earned {predefinedQuizOverallPoints + finalScoreData.score} total points for this module quiz attempt!</p>}
        {isLiveQuiz && <p className="text-slate-300 mb-6 text-sm">You've completed the live quiz!</p>}
        <h4 className="text-lg md:text-xl font-semibold text-sky-300 mt-6 mb-3">Detailed Feedback:</h4>
        <div className="space-y-4 text-left max-h-80 md:max-h-96 overflow-y-auto p-3 md:p-4 bg-slate-600 rounded-lg">
            {quiz?.questions?.map((q, idx) => {
                const qKey = q.id || `q-${idx}`;
                return (
                    <div key={qKey} className="p-3 bg-slate-500 rounded">
                        <p className="font-semibold text-sky-200 text-sm md:text-base">{q.text}</p>
                        <p className="text-xs md:text-sm text-slate-300">Your answer: {answers[qKey] || "Not answered"}</p>
                        {q.type === 'mcq' && feedback[qKey] && <p className={`text-xs md:text-sm ${answers[qKey] === q.correctAnswer ? 'text-green-300' : 'text-red-300'}`}>{feedback[qKey]}</p>}
                        {q.type === 'saq' && feedback[qKey] && (
                            <div className="mt-2 p-2 bg-slate-400 rounded text-slate-800 text-xs md:text-sm whitespace-pre-wrap">
                                <strong className="text-slate-900">AI Feedback:</strong><br/> {feedback[qKey]}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        <button onClick={onBackToLessons} className="mt-8 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg text-sm">
          {isLiveQuiz ? (moduleId ? 'Back to Module Lessons' : 'Back to Quiz Generator') : 'Back to Lessons'}
        </button>
      </div>
    );
  }
  
  if (!isLiveQuiz && isPredefinedQuizCompleted && !showResults) { 
    // ... (logic for already completed predefined quiz) ...
  }

  if (!currentQuestion) { 
    console.log("QuizView: No currentQuestion, rendering loading/empty state for quiz:", quiz?.title); 
    return (
        <div className="p-6 text-slate-400 flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
            <Loader2 className="animate-spin h-10 w-10 text-sky-400 mb-3" />
            {isLiveQuiz ? `Generating your live quiz on "${quiz?.title || moduleTitle || 'the selected topic'}"...` : "Loading quiz questions..."}
            {quiz?.questions && quiz.questions.length === 0 && " No questions found for this quiz."}
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {showSocraticTutor && socraticQuestionContext && (
          <SocraticTutorModal
              isOpen={showSocraticTutor}
              onClose={() => setShowSocraticTutor(false)}
              questionText={socraticQuestionContext.questionText}
              studentAnswer={socraticQuestionContext.studentAnswer} // Pass current main answer
              onNewAnswer={(newAnswer) => { // Optional: if tutor helps refine main answer
                  // setAnswers(prev => ({ ...prev, [questionKey]: newAnswer }));
              }}
          />
      )}
      <h2 className="text-2xl md:text-3xl font-bold text-sky-400 mb-2">{quiz?.title}</h2>
      <p className="text-slate-400 mb-6 text-sm">Question {currentQuestionIndex + 1} of {quiz?.questions?.length}</p>
      
      <div className="bg-slate-700 p-4 md:p-6 rounded-xl shadow-lg">
        <p className="text-lg md:text-xl text-sky-300 mb-4">{currentQuestion.text}</p>
        {currentQuestion.type === 'mcq' && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index} 
                onClick={() => handleAnswer(option)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors text-sm md:text-base 
                  ${answers[questionKey] === option ? 
                    (option === currentQuestion.correctAnswer ? 'bg-green-500 border-green-700 text-white' : 'bg-red-500 border-red-700 text-white') : 
                    'bg-slate-600 border-slate-500 hover:bg-slate-500 text-white'}`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
        {currentQuestion.type === 'saq' && ( 
          <div>
            <textarea
              value={answers[questionKey] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              rows="6"
              className="w-full p-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm md:text-base"
              placeholder="Type your answer here..."
            />
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleShortAnswerSubmit}
                  disabled={shortAnswerLoading}
                  className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 text-sm flex items-center justify-center"
                >
                  {shortAnswerLoading ? <Loader2 className="animate-spin h-5 w-5 inline mr-2" /> : null}
                  {shortAnswerLoading ? 'Generating Feedback...' : 'Submit for AI Feedback'}
                </button>
                <button
                  onClick={openSocraticTutor}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center justify-center"
                >
                  <MessageCircleQuestion size={18} className="mr-2" /> AI Tutor
                </button>
            </div>
          </div>
        )}
        {feedback[questionKey] && (
          <div className={`mt-4 p-3 rounded-lg text-xs md:text-sm ${
            currentQuestion.type === 'mcq' ? 
            (answers[questionKey] === currentQuestion.correctAnswer ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100') :
            'bg-slate-600 text-slate-200 whitespace-pre-wrap'
          }`}>
            <strong className="block mb-1">Feedback:</strong> {feedback[questionKey]}
          </div>
        )}
         <p className="text-xs md:text-sm text-yellow-400 mt-4">This question is worth {currentQuestion.points || (currentQuestion.type === 'mcq' ? 10 : 20)} points.</p>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={onBackToLessons}
          className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg text-sm"
        >
          {isLiveQuiz ? (moduleId ? 'Back to Module Lessons' : 'Back to Quiz Generator') : 'Back to Lessons'} 
        </button>
        <button
          onClick={handleNextQuestion}
          disabled={currentQuestion.type === 'mcq' && !answers[questionKey] } 
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 text-sm"
        >
          {currentQuestionIndex < (quiz?.questions?.length || 0) - 1 ? 'Next Question' : 'Finish Quiz'}
        </button>
      </div>
    </div>
  );
}


// --- Main App Component ---
// App component remains the same as the last version (with live module quiz logic)
// ... (ensure App component is complete from previous version) ...
function App() {
  console.log("App component rendering..."); 
  const [selectedModule, setSelectedModule] = useState(null);
  const { user, loading: authLoading, authError } = useContext(AuthContext); 
  const { userData, loadingData: userDataLoading } = useContext(UserDataContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  const [liveModuleQuiz, setLiveModuleQuiz] = useState(null);
  const [isGeneratingModuleQuiz, setIsGeneratingModuleQuiz] = useState(false);
  const [currentLiveQuizModuleInfo, setCurrentLiveQuizModuleInfo] = useState(null); 


  const handleGenerateLiveModuleQuiz = async (topic, moduleId, moduleTitle) => {
    console.log("App: handleGenerateLiveModuleQuiz called for topic:", topic, "Module ID:", moduleId);
    setIsGeneratingModuleQuiz(true);
    setLiveModuleQuiz(null); 
    setCurrentLiveQuizModuleInfo({ id: moduleId, title: moduleTitle }); 
    setSelectedModule(null); 

    try {
        const response = await fetch('/.netlify/functions/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic, numMCQs: 2, numSAQs: 1 }), 
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Module quiz generation failed: ${response.status}`);
        }
        const data = await response.json();
        if (data.quiz && data.quiz.questions && data.quiz.questions.length > 0) {
            const questionsWithIds = data.quiz.questions.map((q, index) => ({
                ...q,
                id: q.id || `live-mod-q-${moduleId}-${index}`
            }));
            setLiveModuleQuiz({ ...data.quiz, questions: questionsWithIds, title: `Quiz: ${moduleTitle}` }); 
        } else {
            throw new Error('Generated module quiz data is not in expected format or empty.');
        }
    } catch (error) {
        console.error("Error generating live module quiz:", error);
        setLiveModuleQuiz({ title: `Error generating quiz for ${moduleTitle}`, questions: [] }); 
    } finally {
        setIsGeneratingModuleQuiz(false);
    }
  };


  if (authLoading) { 
    console.log("App: In authLoading state..."); 
    return <div className="flex justify-center items-center h-screen bg-slate-900 text-white"><Sparkles className="animate-spin h-8 w-8 mr-2" />Authenticating...</div>;
  }
  
  if (!user) { 
     console.log("App: No user after auth loading, showing AuthForm."); 
     return <AuthForm />; 
  }

  if (userDataLoading && user) { 
    console.log("App: User exists, but in userDataLoading state..."); 
    return <div className="flex justify-center items-center h-screen bg-slate-900 text-white"><Sparkles className="animate-spin h-8 w-8 mr-2" />Loading Your Workbook Data...</div>;
  }
  
  if (authError && !user) { 
      console.log("App: Auth error exists and no user, showing AuthForm.");
      return <AuthForm />;
  }

  if (isGeneratingModuleQuiz || liveModuleQuiz) {
      return (
        <div className="flex flex-col h-screen bg-slate-900 text-white font-sans overflow-hidden">
          <Header currentModuleTitle={currentLiveQuizModuleInfo?.title || "Live Quiz"} />
          <div className="md:hidden p-2 bg-slate-800 fixed top-[72px] left-0 z-50 shadow-md"> 
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-300 hover:text-white">
                {isSidebarOpen ? <X size={28}/> : <Menu size={28}/>}
            </button>
          </div>
          <div className="flex flex-1 pt-12 md:pt-0 overflow-hidden">
            <Sidebar 
                modules={modulesData} 
                selectedModule={modulesData.find(m => m.id === currentLiveQuizModuleInfo?.id)} 
                onSelectModule={(mod) => { setSelectedModule(mod); setLiveModuleQuiz(null); setIsGeneratingModuleQuiz(false); }}
                onShowDashboard={() => { setSelectedModule(null); setLiveModuleQuiz(null); setIsGeneratingModuleQuiz(false); }}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <main className="flex-1 p-0 overflow-y-auto bg-slate-900">
                <QuizView 
                    quiz={liveModuleQuiz} 
                    onBackToLessons={() => {
                        setLiveModuleQuiz(null);
                        setIsGeneratingModuleQuiz(false);
                        setSelectedModule(modulesData.find(m => m.id === currentLiveQuizModuleInfo?.id) || null); 
                    }}
                    moduleTitle={currentLiveQuizModuleInfo?.title} 
                    moduleId={currentLiveQuizModuleInfo?.id}
                    isLiveQuiz={true} 
                    isGenerating={isGeneratingModuleQuiz}
                />
            </main>
          </div>
        </div>
      );
  }


  console.log("App: Rendering main workbook UI. User:", user, "UserData:", userData); 
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans overflow-hidden">
      <Header currentModuleTitle={selectedModule?.title} />
      <div className="md:hidden p-2 bg-slate-800 fixed top-[72px] left-0 z-50 shadow-md"> 
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-300 hover:text-white">
              {isSidebarOpen ? <X size={28}/> : <Menu size={28}/>}
          </button>
      </div>

      <div className="flex flex-1 pt-12 md:pt-0 overflow-hidden"> 
        <Sidebar 
            modules={modulesData} 
            selectedModule={selectedModule} 
            onSelectModule={(mod) => { setSelectedModule(mod); setLiveModuleQuiz(null); setIsGeneratingModuleQuiz(false); }}
            onShowDashboard={() => { setSelectedModule(null); setLiveModuleQuiz(null); setIsGeneratingModuleQuiz(false); }}
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
        />
        <main className="flex-1 p-0 overflow-y-auto bg-slate-900"> 
            {selectedModule ? (
              <ModuleView 
                module={selectedModule} 
                onGenerateLiveQuiz={handleGenerateLiveModuleQuiz} 
              />
            ) : (
              <Dashboard modules={modulesData} onSelectModule={setSelectedModule} userData={userData} />
            )}
        </main>
      </div>
    </div>
  );
}


// Wrap App with Providers
export default function WrappedApp() {
  console.log("WrappedApp rendering..."); 
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
       console.error("WrappedApp: Firebase config is using placeholder YOUR_API_KEY."); 
       return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-8 text-center">
              <Sparkles size={48} className="text-red-500 mb-4" />
              <h1 className="text-3xl font-bold text-red-400 mb-4">Firebase Configuration Error</h1>
              <p className="text-slate-300 mb-2">
                  The Firebase configuration is still using placeholder values (<code>YOUR_API_KEY</code>).
                  Please ensure you have replaced these with your actual Firebase project details in the code.
              </p>
          </div>
      );
  }

  return (
    <AuthProvider>
      <UserDataProvider>
        <App />
      </UserDataProvider>
    </AuthProvider>
  );
}
