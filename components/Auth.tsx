import React, { useState } from 'react';
import { User } from '../types';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, CheckCircle, Chrome } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'register' | 'verify'>('login');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Verification State
  const [verificationCode, setVerificationCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call and Email sending
    setTimeout(() => {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setVerificationCode(code);
      setIsLoading(false);
      setView('verify');
      
      // Show simulated email toast
      setShowToast(true);
    }, 1500);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode === verificationCode) {
      setIsLoading(true);
      setTimeout(() => {
        const newUser: User = {
          id: 'user_' + Date.now(),
          name,
          email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff`
        };
        onLogin(newUser);
      }, 1000);
    } else {
      alert("Código incorreto!");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate Login Check
    setTimeout(() => {
      // In a real app we would check credentials. Here we just mock it for the demo user.
      const user: User = {
        id: 'user_demo',
        name: 'Estudante Demo',
        email: email,
        avatar: `https://ui-avatars.com/api/?name=Estudante+Demo&background=0ea5e9&color=fff`
      };
      onLogin(user);
    }, 1000);
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const user: User = {
        id: 'user_google_' + Date.now(),
        name: 'Usuário Google',
        email: 'usuario@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c' // Generic google-like avatar
      };
      onLogin(user);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-200/30 rounded-full blur-3xl" />

      {/* Simulated Email Toast */}
      {showToast && view === 'verify' && (
        <div className="fixed top-4 right-4 bg-white p-4 rounded-xl shadow-2xl border border-brand-100 z-50 animate-in slide-in-from-right max-w-sm">
           <div className="flex items-start gap-3">
              <div className="bg-brand-100 p-2 rounded-full text-brand-600">
                <Mail size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Novo Email de Lebombo</h4>
                <p className="text-xs text-slate-500 mt-1">Seu código de verificação é:</p>
                <p className="text-xl font-bold text-brand-600 tracking-widest mt-1">{verificationCode}</p>
                <button 
                  onClick={() => { navigator.clipboard.writeText(verificationCode); alert("Código copiado!"); }}
                  className="text-[10px] text-blue-500 hover:underline mt-2"
                >
                  Copiar Código
                </button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-8 border border-slate-100 relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-xl mb-3 shadow-lg shadow-brand-200">
            LB
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {view === 'login' && 'Bem-vindo de volta'}
            {view === 'register' && 'Crie sua conta'}
            {view === 'verify' && 'Verifique seu email'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {view === 'login' && 'Entre para continuar seus estudos.'}
            {view === 'register' && 'Comece sua jornada de aprendizado.'}
            {view === 'verify' && `Enviamos um código para ${email}`}
          </p>
        </div>

        {view === 'verify' ? (
           <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Código de Verificação</label>
                <input 
                  type="text" 
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-center text-2xl tracking-widest font-mono"
                  placeholder="0000"
                  maxLength={4}
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all flex justify-center items-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <>Confirmar <CheckCircle size={18} /></>}
              </button>
              <button 
                type="button"
                onClick={() => setView('register')}
                className="w-full text-center text-sm text-slate-400 hover:text-brand-600 mt-4"
              >
                Voltar
              </button>
           </form>
        ) : (
          <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-4">
            
            {view === 'register' && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input 
                  type="text"
                  required 
                  placeholder="Seu Nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input 
                type="email" 
                required
                placeholder="Seu Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input 
                type="password" 
                required
                placeholder="Sua Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {view === 'login' ? 'Entrar' : 'Criar Conta'} <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400">Ou continue com</span>
                </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex justify-center items-center gap-2"
            >
               <Chrome size={18} className="text-red-500"/> Google
            </button>
            
            <p className="text-center text-sm text-slate-500 mt-6">
              {view === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button 
                type="button"
                onClick={() => setView(view === 'login' ? 'register' : 'login')}
                className="text-brand-600 font-bold ml-1 hover:underline"
              >
                {view === 'login' ? 'Cadastre-se' : 'Faça Login'}
              </button>
            </p>

          </form>
        )}
      </div>
    </div>
  );
};

export default Auth;
