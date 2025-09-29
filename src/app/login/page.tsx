'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import RecaptchaV2Invisible, { RecaptchaV2Handle } from '@/components/RecaptchaV2Invisible';

type PendingCreds = { email: string; senha: string } | null;

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const recaptchaRef = useRef<RecaptchaV2Handle>(null);
  const pendingCreds = useRef<PendingCreds>(null);

  const normalizeEmail = (raw: string) =>
    raw
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._%+\-@]/g, '')
      .trim();

  // Chamado pelo reCAPTCHA invisível quando gerar o token
  const onVerify = async (token: string) => {
    try {
      // Ignora callbacks atrasados
      if (!pendingCreds.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[login] onVerify ignorado: sem pendingCreds');
        }
        return;
      }

      // 1) valida o token no backend
      const resp = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json();
      if (!data?.success) {
        setErro('Falha na verificação do reCAPTCHA.');
        return;
      }

      // 2) usa as credenciais capturadas no submit
      const { email: mail, senha: pass } = pendingCreds.current;

      if (process.env.NODE_ENV !== 'production') {
        // @ts-ignore
        console.debug('[login] projectId:', auth?.app?.options?.projectId);
        console.debug('[login] email (submit):', JSON.stringify(mail));
      }

      const cred = await signInWithEmailAndPassword(auth, mail, pass);

      // 3) garante doc mínimo no Firestore
      const ref = doc(db, 'usuarios', cred.user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            uid: cred.user.uid,
            email: cred.user.email || mail,
            nome: cred.user.displayName || '',
            celular: cred.user.phoneNumber || '',
            telefoneVerificado: !!cred.user.phoneNumber,
            cep: '',
            cidade: '',
            uf: '',
            papel: 'cliente',
            ativo: true,
            criadoEm: serverTimestamp(),
          },
          { merge: true }
        );
      }

      router.push('/produtos');
    } catch (e: any) {
      console.error('[login] error:', e);
      const code = String(e?.code || e?.message || e);
      if (code.includes('invalid-email')) setErro('E-mail inválido.');
      else if (code.includes('wrong-password') || code.includes('invalid-credential'))
        setErro('Senha incorreta.');
      else if (code.includes('user-not-found')) setErro('Conta não encontrada. Cadastre-se.');
      else setErro('Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
      pendingCreds.current = null; // limpa tentativa
      recaptchaRef.current?.reset();
    }
  };

  // Submit → captura credenciais e dispara o reCAPTCHA
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErro('');
    setLoading(true);

    const mail = normalizeEmail(email);

    // valida formato antes do captcha
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setLoading(false);
      setErro('E-mail inválido.');
      return;
    }

    // guarda as credenciais desta tentativa
    pendingCreds.current = { email: mail, senha };

    recaptchaRef.current?.execute();
  };

  // Google
  const handleGoogleSignIn = async () => {
    setErro('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const ref = doc(db, 'usuarios', user.uid);
      const snap = await getDoc(ref);
      const mail = normalizeEmail(user.email || email || '');

      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            uid: user.uid,
            email: mail,
            nome: user.displayName || '',
            celular: user.phoneNumber || '',
            telefoneVerificado: !!user.phoneNumber,
            cep: '',
            cidade: '',
            uf: '',
            papel: 'cliente',
            ativo: true,
            provedor: 'google',
            criadoEm: serverTimestamp(),
          },
          { merge: true }
        );
      }

      router.push('/produtos');
    } catch (e: any) {
      console.error('[google] error:', e);
      const code = String(e?.code || e?.message || e);
      if (code.includes('popup-blocked')) setErro('Pop-up bloqueado. Desative o bloqueador e tente novamente.');
      else if (code.includes('popup-closed-by-user')) setErro('Pop-up fechado antes de concluir.');
      else if (code.includes('account-exists-with-different-credential'))
        setErro('Este e-mail já existe com outro método. Faça login pelo método original.');
      else setErro('Erro ao entrar com Google.');
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen px-4 text-white bg-black">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 rounded-lg shadow-lg bg-neutral-900">
        <h1 className="mb-6 text-3xl font-bold text-center text-yellow-400">Entrar na Conta</h1>

        {erro && <p className="mb-4 text-center text-red-500">{erro}</p>}

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-3 mb-4 text-black placeholder-gray-500 bg-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
          autoComplete="email"
        />

        <div className="relative mb-4">
          <input
            type={mostrarSenha ? 'text' : 'password'}
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="w-full p-3 pr-10 text-black placeholder-gray-500 bg-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
            autoComplete="current-password"
            minLength={6}
          />
          <button
            type="button"
            className="absolute text-gray-600 right-3 top-3"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {mostrarSenha ? '🙈' : '👁️'}
          </button>
        </div>

        <div className="mb-4 text-right">
          <a href="/recuperar" className="text-sm text-yellow-400 hover:underline">
            Esqueceu a senha?
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 font-semibold text-black transition bg-yellow-400 rounded hover:bg-yellow-500 disabled:opacity-60"
        >
          {loading ? 'Verificando…' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex items-center justify-center w-full gap-2 py-2 mt-3 font-semibold text-white transition bg-blue-600 rounded hover:bg-blue-700"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5 bg-white rounded-full p-0.5"
          />
          Entrar com Google
        </button>

        <p className="mt-6 text-sm text-center">
          Ainda não tem uma conta?{' '}
          <a href="/cadastro" className="text-yellow-400 hover:underline">
            Cadastrar
          </a>
        </p>
      </form>

      {/* Widget invisível (não ocupa layout) */}
      <RecaptchaV2Invisible ref={recaptchaRef} onVerify={onVerify} />
    </main>
  );
}
