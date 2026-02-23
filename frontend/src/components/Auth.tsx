import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, ChevronLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const roleConfig = {
    student: { color: 'bg-sunny', accent: '#FFD93D', label: 'Student', emoji: '🎒', gradient: 'from-sunny/20 to-sunny-light' },
    teacher: { color: 'bg-mint', accent: '#4ECDC4', label: 'Teacher', emoji: '📚', gradient: 'from-mint/20 to-mint-light' },
    admin: { color: 'bg-grape', accent: '#A66DD4', label: 'Admin', emoji: '⚙️', gradient: 'from-grape/20 to-grape-light' },
};

const Auth: React.FC = () => {
    const [searchParams] = useSearchParams();
    const roleParam = searchParams.get('role') as keyof typeof roleConfig | null;
    const initialRole = roleParam && roleConfig[roleParam] ? roleParam : 'student';

    const [isLogin, setIsLogin] = useState(true);
    const [role] = useState<'student' | 'teacher' | 'admin'>(initialRole);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const navigate = useNavigate();
    const config = roleConfig[role];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // TODO: Replace with real Firebase Auth call
            // e.g. await signInWithEmailAndPassword(auth, email, password)
            // or await createUserWithEmailAndPassword(auth, email, password)

            // Simulating a network request for the UI
            setTimeout(() => {
                login(role); // Sets the role in our mock auth context
                navigate(`/${role}/dashboard`);
            }, 1500);

        } catch (err: any) {
            setError(err.message || 'Failed to authenticate');
            setLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        // TODO: Google Sign In with Firebase
        login(role);
        navigate(`/${role}/dashboard`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8f0ff] via-[#e8f4fd] to-[#fff8e1] p-4">

            {/* ─── Floating decorative shapes ─── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[10%] left-[5%] w-24 h-24 rounded-full bg-sunny/20 animate-float" />
                <div className="absolute top-[20%] right-[10%] w-32 h-32 rounded-3xl bg-sky/15 animate-float-reverse delay-200 rotate-12" />
                <div className="absolute bottom-[15%] left-[15%] w-20 h-20 rounded-2xl bg-mint/20 animate-float delay-500 rotate-45" />
            </div>

            <div className="relative z-10 w-full max-w-md animate-slide-up">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-text-soft hover:text-text transition-colors mb-6 font-medium"
                >
                    <ChevronLeft size={20} />
                    Back to Roles
                </button>

                <div className="bg-white rounded-[2rem] shadow-card overflow-hidden border border-border-light relative">

                    {/* Top Graphic Bar */}
                    <div className={`h-3 w-full bg-gradient-to-r ${config.gradient}`} />

                    <div className="p-8 md:p-10">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 bg-gradient-to-br ${config.gradient} shadow-sm animate-bounce-in`}>
                                {config.emoji}
                            </div>
                            <h2 className="text-2xl font-black text-text font-comic">
                                {isLogin ? 'Welcome Back!' : 'Join IncludEd'}
                            </h2>
                            <p className="text-sm text-text-soft mt-1">
                                Continue as <span className="font-bold text-text">{config.label}</span>
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-coral-light/50 border border-coral/20 text-coral-dark px-4 py-3 rounded-xl mb-6 text-sm font-medium flex items-center animate-fade-in">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-text-soft uppercase tracking-wider ml-1">Full Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User size={18} className="text-text-muted" />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="block w-full pl-11 pr-4 py-3 bg-surface border border-border-light rounded-xl text-text placeholder-text-muted focus:ring-2 focus:ring-sky/50 focus:border-sky transition-all outline-none"
                                            placeholder="Jane Doe"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-text-soft uppercase tracking-wider ml-1">Email</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail size={18} className="text-text-muted" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3 bg-surface border border-border-light rounded-xl text-text placeholder-text-muted focus:ring-2 focus:ring-sky/50 focus:border-sky transition-all outline-none"
                                        placeholder="you@school.edu"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-xs font-semibold text-text-soft uppercase tracking-wider">Password</label>
                                    {isLogin && (
                                        <a href="#" className="text-xs text-sky font-medium hover:underline focus:outline-none">
                                            Forgot?
                                        </a>
                                    )}
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock size={18} className="text-text-muted" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3 bg-surface border border-border-light rounded-xl text-text placeholder-text-muted focus:ring-2 focus:ring-sky/50 focus:border-sky transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-sky to-ocean hover:from-ocean hover:to-sky-dark text-white rounded-xl font-bold shadow-soft hover:shadow-hover transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-6 group"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? 'Sign In' : 'Create Account'}
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 relative flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border-light" />
                            </div>
                            <div className="relative px-4 bg-white text-xs font-medium text-text-muted uppercase tracking-wider">
                                Or continue with
                            </div>
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={handleGoogleSignIn}
                                type="button"
                                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-border hover:border-text-muted rounded-xl text-text font-semibold shadow-sm hover:shadow-soft transition-all"
                            >
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google logo" />
                                Google
                            </button>
                        </div>

                    </div>

                    <div className="px-8 py-5 bg-surface border-t border-border-light text-center">
                        <p className="text-sm text-text-soft">
                            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-sky font-bold hover:underline focus:outline-none"
                            >
                                {isLogin ? 'Sign Up' : 'Log In'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
