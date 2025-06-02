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
    Users, Lightbulb, MessageSquare, LogOut, UserCircle, Sparkles, Mail, KeyRound, UserPlus, Menu, X, Wand2, Loader2, Bot // Added Bot
} from 'lucide-react';

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

// --- CORRECTED modulesData with Robotics Module ---
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
    id: 'robotics-autonomy',
    title: '3.7 Robotics and Autonomous Technologies',
    description: 'Investigate different types of robots and autonomous technologies, their uses, and the dilemmas these developments have brought about.',
    icon: Bot, // Using Bot icon from lucide-react
    lessons: [
        {
            id: 'robotics-lesson-1',
            title: 'Understandings & Introduction to Robotics',
            type: 'theory',
            points: 10,
            content: `
                <p>Robots and autonomous technologies demonstrate a capacity to sense, think and/or act with some degree of independence[cite: 1]. They have evolved over time and are increasingly ubiquitous, pervasive and woven into the everyday lives of people and communities[cite: 1]. This integration introduces significant opportunities and dilemmas in digital society[cite: 1].</p>
                <p>The word "robot" was first introduced in a science fiction play in 1921 and is now a reality[cite: 2]. Robots have transformed manufacturing by increasing efficiency, safety and accuracy, often at the cost of replacing jobs[cite: 3]. Current development focuses on service and social robots aimed at working alongside humans[cite: 4].</p>
            `
        },
        {
            id: 'robotics-lesson-2',
            title: 'Types of Robots and Autonomous Technologies',
            type: 'theory',
            points: 15,
            content: `
                <p>A robot is essentially a programmable machine that can complete a set task with little or no human intervention[cite: 7, 17]. Robots have evolved in two distinct categories: those for manufacturing and those for human interaction[cite: 10].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Industrial Robots</h4>
                <p>Demand for robots in manufacturing has been a driving force since the 1960s[cite: 12]. They perform tasks like drilling, painting, welding, assembly, and material handling[cite: 13]. These robots have replaced many human workers but differ from service robots, which often assist workers or customers in fields like agriculture or construction[cite: 14, 15]. Example: Great Wall Motors increased automation in 2014 with collaborating robots for panel positioning and welding[cite: 18, 19]. Foxconn planned to replace 60,000 jobs with automation by 2020[cite: 20].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Service Robots</h4>
                <p>Service robots assist humans with undesirable tasks—dull, dirty, or dangerous jobs[cite: 21, 26]. They can be for domestic (e.g., robot vacuums[cite: 25], pool cleaners, lawnmowers, robotized wheelchairs [cite: 23]) or professional/commercial use (e.g., cleaning public places, deliveries, surgery assistance [cite: 33, 34]). They can work efficiently, accurately, and with little downtime[cite: 38]. Example: Flippy 2, a grill chef robot, handles unpleasant, repetitive cooking tasks in fast-food chains[cite: 39, 40, 41].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Virtual Personal Assistants</h4>
                <p>These are voice-controlled helpers like Google Home or Amazon Echo, found in smart speakers or phones[cite: 28, 43]. They perform tasks like weather updates, setting timers, or reading news via voice commands[cite: 29]. Example: Hampshire County Council trialled virtual assistants to support elderly and disabled people with tasks like controlling smart home devices[cite: 30, 31].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Social Robots</h4>
                <p>Unlike service robots, social robots are designed to interact and communicate with humans acceptably[cite: 44, 45]. They are used in customer service or as home companions for the elderly[cite: 46]. Limitations include a potential lack of empathy and inappropriate responses to unknown situations[cite: 47]. Example: Jibo, a home social robot, provided companionship and voice assistance using facial/voice recognition[cite: 49, 50]. Aerobot at Istanbul Airport communicates in over 20 languages and guides passengers[cite: 55, 56, 57].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Internet of Things (IoT) in Industry</h4>
                <p>Businesses use sensors on components to collect data for improving production lines or services[cite: 65]. Benefits are similar to home IoT but on a larger scale[cite: 66]. Uses include predictive maintenance (sensors alert when a machine needs maintenance [cite: 67]), energy optimization[cite: 68], location tracking (GPS, RFID for stock/equipment [cite: 69]), remote quality monitoring (e.g., water/air quality [cite: 70, 71]), and workplace analytics[cite: 72].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Autonomous Vehicles (AVs)</h4>
                <p>AVs can operate without human intervention[cite: 77, 96]. SAE defines levels of autonomy (0-5)[cite: 79]. Levels 0-2 augment the driver (e.g., adaptive cruise control[cite: 83], lane assist[cite: 83], self-parking like Mercedes PARKTRONIC [cite: 86, 87]). Level 3 allows self-driving under certain conditions (e.g., traffic jams [cite: 88, 89]). Levels 4 & 5 do not require a driver and may lack steering wheels/pedals[cite: 90, 91]. Level 4 examples include driverless taxis (like Singapore's 2016 trial [cite: 97, 98]) but operate under specific conditions (e.g., weather [cite: 93, 94]). Level 5 (full automation, no restrictions) is not yet achieved[cite: 101]. Benefits include fewer accidents and reduced congestion[cite: 102]. Challenges include sensor reliability in bad weather/graffiti[cite: 104], standards for AI training[cite: 107], ensuring safety as deep learning evolves[cite: 109], developing regulations[cite: 110], and gaining social acceptability after accidents[cite: 112, 113].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Drones (UAVs)</h4>
                <p>Drones are flying robots, remote-controlled or autonomous[cite: 135, 137]. Formerly military (practice, data gathering, attacks [cite: 135]), they now have commercial/private uses (delivery, surveillance, search/rescue, video [cite: 136]). They need to be lightweight with propellers and power for flight; GPS and sensors for navigation and data collection[cite: 138, 139, 140]. Example: Zipline in Ghana uses drones for medical supply delivery[cite: 142].</p>
            `
        },
        {
            id: 'robotics-lesson-3',
            title: 'Characteristics of Robots and Autonomous Technologies',
            type: 'theory',
            points: 15,
            content: `
                <p>Robots demonstrate a capacity to sense, think, and act with some degree of independence[cite: 1]. Key characteristics include:</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Sensory Inputs for Awareness</h4>
                <p>Robots perceive their environment similarly to human senses:</p>
                <ul class="list-disc list-inside space-y-1">
                    <li><strong>Vision:</strong> Digital cameras (stereo vision for depth perception [cite: 148]), light sensors (day/night detection [cite: 150]), infrared/ultrasound sensors (object distance [cite: 151, 152]), GPS (location [cite: 153]). Advanced AVs use lidar (shape/contour of ground [cite: 156]), sonar (water depth [cite: 157]), and radar (moving objects, environment shape [cite: 154, 155, 158]).</li>
                    <li><strong>Hearing:</strong> Microphones collect sound, used with voice recognition to understand speech[cite: 159, 160].</li>
                    <li><strong>Smell and Taste:</strong> Chemical sensors collect data for pattern recognition to identify smells or tastes (e.g., pH sensor for food [cite: 161, 162, 163]).</li>
                    <li><strong>Touch:</strong> Pressure sensors or resistive/capacitive touch sensors determine grip strength or detect objects/human touch[cite: 164]. Temperature sensors allow reactions to specific temperatures (e.g., firefighting robots [cite: 165, 166]).</li>
                </ul>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Logical Reasoning with Inputs</h4>
                <p>A robot's control system processes sensor data for decision-making, sending commands to actuators[cite: 167]. Basic AI allows problem-solving in limited domains (e.g., inspection robots comparing data to stored values [cite: 168, 169, 170]). More recent robots use machine learning to learn and adapt[cite: 171, 173]. Supervised learning can be used for part selection on production lines[cite: 175]. Reinforcement learning helps AVs adapt[cite: 176]. Deep learning enhances machine vision for better accuracy[cite: 177, 178].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Ability to Interact and Move</h4>
                <p>Most robots have moving parts using actuators (electric motors, hydraulic/pneumatic systems [cite: 180, 181, 200]) powered by batteries or main electricity[cite: 182]. End effectors (peripheral devices [cite: 201]) are attached to actuators[cite: 183, 184], including grippers (for manipulating objects [cite: 185, 186]), process tools (welding, painting [cite: 187]), and sensors (for inspections [cite: 188]).</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Degree of Autonomy</h4>
                <p>The level of autonomy defines independence from a controller[cite: 189]. Semi-autonomous robots have some intelligence and can react to certain conditions (e.g., a basic robot vacuum avoiding obstacles [cite: 190, 191, 192, 193]). Fully autonomous robots operate independently on more complex tasks, though often restricted to specific environments, but will become more adaptable with technological advances[cite: 194, 195].</p>
            `
        },
        {
            id: 'robotics-lesson-4',
            title: 'Evolution of Robotics',
            type: 'evolution',
            points: 10,
            content: `
                <p>The history of robots is linked to science, technology, and AI[cite: 207]. Early concepts include Egyptian water clocks (1500s BC) and Archytas's steam-powered bird (c. 400 BC)[cite: 209]. In 1948, William Grey Walter created Elmer and Elsie, tortoise-like robots that could find their charging station[cite: 210, 211, 212]. 'Shakey' (1958) could observe, move in unfamiliar areas, and make simple responses[cite: 213, 214, 215].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Robots in Science Fiction and Asimov's Laws</h4>
                <p>Karel Capek introduced "robot" in his 1921 play "Rossum's Universal Robots"[cite: 217, 218]. Isaac Asimov's Three Laws of Robotics (1941) are: 1. Must not injure humans. 2. Must obey humans (unless conflicting with Law 1). 3. Must protect its own existence (unless conflicting with Laws 1 or 2)[cite: 219, 220]. A "Zeroth Law" was added later: A robot may not injure humanity or allow humanity to come to harm, unless this violates a higher order law[cite: 221, 222].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Industrial and Manufacturing Robots Timeline</h4>
                <ul class="list-disc list-inside space-y-1">
                    <li><strong>1954-61:</strong> Unimate (USA), first programmable industrial robot for General Motors (diecasting, welding)[cite: 228, 229].</li>
                    <li><strong>1974:</strong> IRB-6 (Sweden), first electric microcomputer-controlled industrial robot (welding, polishing)[cite: 224, 225].</li>
                    <li><strong>1981 (Consight):</strong> General Motors used visual sensors with robots to select auto parts[cite: 230].</li>
                    <li><strong>1981 (SCARA):</strong> Japan developed a dexterous robotic arm for loading/unloading[cite: 226].</li>
                    <li><strong>1994:</strong> Motorman MRC (USA) supported up to 21 axes and synchronized robots[cite: 231].</li>
                    <li><strong>2008:</strong> Universal Robots UR5 (Denmark), first collaborative robot (cobot)[cite: 227].</li>
                </ul>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Humanoid and Interactive Robots Timeline</h4>
                <ul class="list-disc list-inside space-y-1">
                    <li><strong>1973:</strong> Wabot-1 (Japan), first humanoid with machine intelligence (walk, grip, see, communicate)[cite: 234, 235].</li>
                    <li><strong>1986 (ASIMO):</strong> Honda's robot could run, climb, kick, sing, respond to voice[cite: 236]. (Note: ASIMO first public demo was 2000, development started 1986).</li>
                    <li><strong>1998:</strong> AIBO (Sony, Japan), robot pet dog with lifelike movement and sensors[cite: 237].</li>
                    <li><strong>2004:</strong> PARO (Japan), therapeutic robotic baby seal for stress reduction[cite: 238].</li>
                    <li><strong>2013:</strong> Baxter (Rethink Robotics, Germany), first humanoid industrial robot for general use[cite: 239].</li>
                    <li><strong>2015:</strong> Robear (Japan), giant bear robot hospital aid[cite: 240].</li>
                    <li><strong>2018:</strong> Pepper (Softbank, Japan), child-size robot that can dance, joke, navigate[cite: 241].</li>
                    <li><strong>2021:</strong> Astro (Amazon, USA), "Alexa on Wheels" home assistant combining robotics, AI, monitoring, cloud[cite: 242].</li>
                </ul>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Machine Consciousness and Cognitive Robotics</h4>
                <p>Early interactive robots likely did not have consciousness[cite: 247]. Machine consciousness requires strong AI[cite: 248]. Cognitive robotics aims to design robots with human-like intelligence that can perceive, plan, deal with uncertainty, and learn continuously[cite: 249, 250, 251]. Example: Sophia (2016) had human-like features, imitated gestures, answered questions, and was designed to learn. Granted citizenship by Saudi Arabia, raising questions about robot rights[cite: 252, 253, 254, 255, 256, 257].</p>
            `
        },
        {
            id: 'robotics-lesson-5',
            title: 'Dilemmas and Ethical Considerations',
            type: 'dilemmas',
            points: 20,
            content: `
                <p>Advancements in robotics bring benefits like aiding people with disabilities and increasing manufacturing efficiency, but also challenges and unintended consequences[cite: 274, 275].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Anthropomorphism and the Uncanny Valley</h4>
                <p>Anthropomorphism is attributing human characteristics to non-human entities like robots[cite: 277, 279]. The "uncanny valley," a concept by Masahiro Mori (1970), describes the eerie feeling people get when robots are very human-like but not perfectly so[cite: 280, 281, 282, 284, 540]. Robots become more appealing as they become more human-like up to a point, after which there's unease[cite: 282, 283]. This is a dilemma for designers: more lifelike robots can be better in some situations (e.g., with autistic children, training) but too lifelike can reduce societal acceptance[cite: 285, 286, 287].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Complexity of Human and Environmental Interactions</h4>
                <p>Developing robots to work alongside unpredictable humans in changing environments is challenging[cite: 291, 292]. Cobots (collaborative robots [cite: 541]) need to understand human emotions, language, and behavior[cite: 293, 294]. The goal may be to develop robots that elicit emotional attachment from humans, rather than emotional robots themselves [cite: 296] (e.g., Kismet by Cynthia Breazeal in the 1990s provoked emotional reactions in humans [cite: 297, 298]). Mimicking human mobility across different terrains is also difficult[cite: 300]. Machine learning and robot vision help navigate obstacles[cite: 301], but robots struggle with unprepared situations (e.g., a fallen tree) and need to relearn/adapt[cite: 302, 303, 304]. This has led to accidents with autonomous vehicles, like the 2018 fatality in Tempe, Arizona[cite: 305, 306, 307].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Uneven and Underdeveloped Laws, Regulations, and Governance</h4>
                <p>Minimizing privacy and security risks is a challenge[cite: 311]. Data used to train robots could be misused, or robots could be hacked[cite: 312]. Data ownership is also a question (end-user, manufacturer, or developer?)[cite: 314]. Asimov's Laws are guiding principles but may need adaptation for varied modern robots [cite: 316, 317, 318, 319, 320, 321] (e.g., military robots potentially violating Law 1 [cite: 322]). Laws may need to differ by context (drones vs. manufacturing robots [cite: 323, 324]). Professor Frank Pasquale proposed additional principles: AI should complement, not replace professionals; not counterfeit humanity; not intensify arms races; and systems must indicate their creator/controller/owner[cite: 325, 326, 327, 328, 329, 330]. Governments are working on legislation: South Korea's Robot Ethics Charter (2007)[cite: 332, 333], UK's ethical design standards (2016)[cite: 334, 335], EU's RoboLaw project (concluded 2014)[cite: 336], and European Parliament discussions (2017)[cite: 337]. Existing product liability laws may apply but could be controversial for complex robots like AVs or prostheses, potentially deterring development if too strict[cite: 338, 339, 340, 341, 342, 343].</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Displacement of Humans</h4>
                <p>Robots impact the workplace by replacing jobs or working alongside humans[cite: 356]. Oxford Economics predicted up to 20 million global manufacturing jobs could be replaced by robots by 2030[cite: 357]. Automation affects lower-skilled jobs, with workers moving to other sectors also facing automation[cite: 357, 358]. Industries with repetitive, predictable tasks (e.g., food industry) are susceptible[cite: 361]. Education and healthcare may see more cobots[cite: 361], where they assist humans (e.g., medical assistants, law enforcement patrols [cite: 362, 363, 364]). Even with cobots, some lower-skilled tasks will be replaced[cite: 365]. New jobs will be created (robot engineers, technicians, sales, software developers, operators [cite: 366, 367]).</p>
                <h4 class="text-lg font-semibold mt-3 mb-1 text-sky-400">Robot Rights and Consciousness</h4>
                <p>As robots advance, their rights are debated, especially concerning machine consciousness (requiring strong AI [cite: 248, 258, 259]). Claims for rights often center on consciousness, which we experience and know exists[cite: 259, 260]. Rights often protect from pain; humans are programmed to learn fairness[cite: 261, 262]. Questions arise: If a robot becomes self-aware, does it deserve rights? Can they feel pain/pleasure, especially if programmed to or if they develop these via deep learning?[cite: 264, 265, 266].</p>
            `
        }
    ],
    quiz: {
      id: 'quiz-robotics-autonomy',
      title: 'Robotics & Autonomous Tech Quiz',
      points: 50, // Overall points for attempting this quiz section
      questions: [
        { id: 'ratq1', type: 'mcq', text: 'What is the fundamental definition of a robot according to the provided material?', options: ['Any machine that uses electricity', 'A programmable machine capable of performing tasks with minimal or no human intervention', 'A human-like machine with AI', 'A remote-controlled device'], correctAnswer: 'A programmable machine capable of performing tasks with minimal or no human intervention', explanation: 'A robot is a programmable machine capable of performing tasks with minimal or no human intervention[cite: 405, 499].', points: 10 },
        { id: 'ratq2', type: 'mcq', text: 'What is a key difference between service robots and social robots?', options: ['Service robots are only for industrial use', 'Social robots cannot move', 'Service robots assist with tasks, social robots are for interaction/communication', 'Only social robots use AI'], correctAnswer: 'Service robots assist with tasks, social robots are for interaction/communication', explanation: 'Service robots assist humans with undesirable tasks[cite: 408, 500], while social robots are designed for social interaction and communication[cite: 409, 501].', points: 10 },
        { id: 'ratq3', type: 'mcq', text: 'Which set of sensors is primarily used by autonomous vehicles for detailed environmental mapping and object detection?', options: ['Microphones and chemical sensors', 'GPS and temperature sensors', 'Lidar, sonar, and radar', 'Pressure sensors and light sensors'], correctAnswer: 'Lidar, sonar, and radar', explanation: 'More sophisticated autonomous vehicles use lidar, sonar, and radar for detailed environmental mapping and object detection[cite: 462].', points: 10 },
        { id: 'ratq4', type: 'mcq', text: 'The "uncanny valley" refers to:', options: ['A scenic route for testing autonomous vehicles', 'The optimal point of robot efficiency', 'An unsettling feeling people get from very lifelike humanoid robots', 'A type of sensor used in robotics'], correctAnswer: 'An unsettling feeling people get from very lifelike humanoid robots', explanation: 'The uncanny valley describes the eerie, unsettling feeling people get when they interact with lifelike humanoid robots or lifelike computer-generated characters[cite: 415, 504].', points: 10 },
        { id: 'ratq5', type: 'mcq', text: 'How does machine learning primarily contribute to robot advancements like walking or object recognition?', options: ['By providing stronger motors for movement', 'By enabling robots to learn from data and improve performance', 'By making robots lighter', 'By giving robots pre-programmed emotional responses'], correctAnswer: 'By enabling robots to learn from data and improve performance', explanation: 'Machine learning enables robots to learn from data and improve their performance, such as in walking abilities or enhancing object recognition[cite: 506, 507, 508].', points: 10 },
        { id: 'ratq6', type: 'mcq', text: 'What are "cobots" primarily designed for?', options: ['Replacing all human workers in factories', 'Performing tasks humans find too complex', 'Working alongside humans to augment their capabilities', 'Exclusively for military applications'], correctAnswer: 'Working alongside humans to augment their capabilities', explanation: 'Cobots are robots designed to work alongside humans and augment their capabilities[cite: 293, 541].', points: 10 },
        { id: 'ratq7', type: 'mcq', text: 'Which of these is a major ethical consideration regarding the increasing use of robots in society, according to the text?', options: ['Robots demanding higher wages', 'The potential for job displacement of human workers', 'Robots requiring too much electricity', 'Robots becoming too friendly'], correctAnswer: 'The potential for job displacement of human workers', explanation: 'A significant dilemma is job displacement, as automation can replace human workers in various industries[cite: 458, 511].', points: 10 },
        { id: 'ratq8', type: 'mcq', text: 'Who first introduced the term "robot" in a science fiction play?', options: ['Isaac Asimov', 'William Grey Walter', 'Karel Capek', 'Charles Rosen'], correctAnswer: 'Karel Capek', explanation: 'Czech writer Karel Capek introduced the term "robot" in his 1921 play Rossum\'s Universal Robots[cite: 217, 439].', points: 10 },
        { id: 'ratq9', type: 'mcq', text: 'According to Asimov\'s First Law of Robotics, a robot must not:', options: ['Obey orders from humans', 'Protect its own existence', 'Injure a human being or, through inaction, allow a human being to come to harm', 'Develop emotions'], correctAnswer: 'Injure a human being or, through inaction, allow a human being to come to harm', explanation: 'Asimov\'s First Law states: A robot must not injure a human being or, through inaction, allow a human being to come to harm[cite: 474].', points: 10 },
        { id: 'ratq10', type: 'mcq', text: 'What does "anthropomorphism" mean in the context of robotics?', options: ['The study of robot mechanics', 'Attributing human characteristics to robots', 'The programming language used for robots', 'The fear of robots'], correctAnswer: 'Attributing human characteristics to robots', explanation: 'Anthropomorphism is the attribution of human characteristics to non-human entities, such as robots[cite: 277, 539].', points: 10 },
      ]
    }
  }
];


// --- UI Components ---
// Header, Sidebar, Dashboard, ModuleView, QuizView, App, WrappedApp
// (These will be the same as the last full version, ensuring Bot is imported in lucide-react imports)
// For brevity, I'm not re-pasting all UI components here but they are assumed to be the same
// as in the last full code block you received, with the addition of Bot to the lucide-react import line.
// The Canvas block with ID ai_ib_workbook_react_email_auth will have the full updated code.

// ... (ensure all UI components like Header, Sidebar, Dashboard, ModuleView, QuizView, SocraticTutorModal are here)
// ... (ensure App and WrappedApp are here)

// For this response, I'm re-pasting just the `App` and `WrappedApp` for context, 
// assuming other components are as per the last complete code block you successfully ran.
// The FULL code with ALL components is in the Canvas block.

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
          const Icon = module.icon || Lightbulb; // Fallback icon
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
          const isModuleCompleted = !module.quizType && userData?.completedQuizzes?.some(q => q.quizId === module.quiz?.id); // Added optional chaining for module.quiz.id
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

  // Ensure module and module.lessons exist before trying to access currentLesson
  if (!module || !module.lessons || module.lessons.length === 0) {
      return <div className="p-6 text-slate-400">Module data or lessons are missing.</div>;
  }
  const currentLesson = module.lessons[currentLessonIndex];
  if (!currentLesson) {
      // This case should ideally not be reached if lessons array is checked
      return <div className="p-6 text-slate-400">Current lesson not found.</div>;
  }


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
    evolution: <BookOpen size={24} className="mr-2 text-indigo-400" />,
    dilemmas: <AlertTriangle size={24} className="mr-2 text-red-400" /> // Added AlertTriangle, import it if not already
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

function SocraticTutorModal({ isOpen, onClose, questionText, studentAnswer, onNewAnswer }) {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [tutorError, setTutorError] = useState('');
    const chatEndRef = React.useRef(null);

    useEffect(() => { 
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => { 
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
                    studentCurrentAnswer: studentAnswer, 
                    conversationHistory: newMessages, 
                    latestStudentChat: currentInput 
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
                    <div ref={chatEndRef} /> 
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

  const [showSocraticTutor, setShowSocraticTutor] = useState(false);
  const [socraticQuestionContext, setSocraticQuestionContext] = useState(null);


  useEffect(() => {
      console.log("QuizView useEffect: Resetting state due to new quiz.", quiz?.title); 
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowResults(false);
      setFeedback({});
      setShowSocraticTutor(false); 
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
  const questionKey = currentQuestion?.id || `q-${currentQuestionIndex}`; 

  const handleAnswer = (answer) => { 
    setAnswers(prev => ({ ...prev, [questionKey]: answer }));
    if (currentQuestion?.type === 'mcq' && currentQuestion.explanation) { 
        setFeedback(prev => ({
            ...prev,
            [questionKey]: answer === currentQuestion.correctAnswer ? `Correct! ${currentQuestion.explanation}` : `Incorrect. The correct answer is ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`
        }));
    }
  };

  const handleShortAnswerSubmit = async () => { 
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
      setShowSocraticTutor(false); 
    } else {
      handleSubmitQuiz();
    }
  };

  const openSocraticTutor = () => {
      if (!currentQuestion) return;
      setSocraticQuestionContext({
          questionText: currentQuestion.text,
          studentAnswer: answers[questionKey] || ""
      });
      setShowSocraticTutor(true);
  };
  
  if (showResults) {
    const finalScoreData = {score: calculateScore(), total: quiz?.questions?.reduce((sum, q) => sum + (q.points || (q.type === 'mcq' ? 10 : (q.type === 'saq' ? 20 : 0))), 0) || 0};
    console.log("QuizView: Showing results.", finalScoreData); 
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
    const completedQuizData = userData.completedQuizzes.find(q => q.quizId === quiz.id);
    return (
        <div className="p-4 md:p-6 bg-slate-700 rounded-xl shadow-lg text-center">
            <CheckCircle size={48} md:size={64} className="mx-auto text-green-400 mb-4" />
            <h3 className="text-2xl md:text-3xl font-bold text-sky-400 mb-4">Quiz Already Completed!</h3>
            {completedQuizData.score &&
                <p className="text-xl md:text-2xl text-white mb-2">
                Your Score for {quiz?.title}: <span className="font-bold text-green-400">{completedQuizData.score.score}</span> / {completedQuizData.score.total}
                </p>
            }
            <p className="text-slate-300 mb-6 text-sm">You can review your stored results or go back to lessons.</p>
            <button
              onClick={() => {
                  setShowResults(true); 
              }}
              className="mt-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg mr-2 text-sm"
            >
              View Stored Results
            </button>
            <button
              onClick={onBackToLessons}
              className="mt-4 bg-slate-500 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg text-sm"
            >
              Back to Lessons
            </button>
        </div>
    );
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
              studentAnswer={socraticQuestionContext.studentAnswer} 
              onNewAnswer={(newAnswer) => { 
                  setAnswers(prev => ({ ...prev, [questionKey]: newAnswer }));
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
