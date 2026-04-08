// src/App.tsx
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Welcome from './pages/Welcome';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import Admin from './pages/Admin';
import SessionEntry from './pages/SessionEntry';

function Header() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();
  const isInQuiz  = pathname === '/quiz';

  const goHome = () => {
    if (!isInQuiz) navigate('/');
  };

  const clickClass = isInQuiz
    ? 'cursor-default'
    : 'cursor-pointer hover:opacity-75 transition-opacity';

  return (
    <header className="w-full bg-white/80 backdrop-blur-xl border-b border-zinc-200/80 px-6 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className={`flex items-center gap-3 ${clickClass}`} onClick={goHome}>
          <img
            src="/images/ptc_logo.png"
            alt="PTC"
            className="h-9 object-contain bg-white rounded-lg border border-zinc-100 shadow-sm p-1"
          />
          <div className="h-5 w-px bg-zinc-200" />
          <img
            src="/images/plural_logo.jpg"
            alt="Plural Technology"
            className="h-9 object-contain bg-white rounded-lg border border-zinc-100 shadow-sm p-1"
          />
        </div>
        <span
          onClick={goHome}
          className={`hidden md:inline-block text-[10px] font-semibold uppercase tracking-widest text-zinc-400 border border-zinc-200 bg-zinc-50 px-3 py-1.5 rounded-full ${clickClass}`}
        >
          Implementation Practitioner Mock Exam
        </span>
      </div>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col items-center font-sans">

        {/* iOS-style translucent sticky nav */}
        <Header />

        <main className="w-full max-w-7xl px-4 py-6 flex-grow flex flex-col">
          <Routes>
            <Route path="/"                    element={<Welcome />} />
            <Route path="/quiz"               element={<Quiz />} />
            <Route path="/results"            element={<Results />} />
            <Route path="/admin"              element={<Admin />} />
            <Route path="/session/:sessionId" element={<SessionEntry />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;
