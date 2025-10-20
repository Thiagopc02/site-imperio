'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import RecaptchaV2Invisible, { RecaptchaV2Handle } from '@/components/RecaptchaV2Invisible';

function mapAuthError(code?: string, message?: string) {
  const combo = `${code ?? ''} ${message ?? ''}`.toLowerCase();
  if (combo.includes('invalid-email')) return 'E-mail inválido.';
  if (combo.includes('user-disabled')) return 'Usuário desativado.';
  if (combo.includes('user-not-found') || combo.includes('email_not_found')) return 'Usuário não encontrado.';
  if (combo.includes('wrong-password') || combo.includes('invalid-credential') || combo.includes('invalid_password')) return 'Senha incorreta.';
  if (combo.includes('too-many-requests')) return 'Muitas tentativas. Tente novamente em instantes.';
  if (combo.includes('network-request-failed')) return 'Falha de rede. Verifique a conexão.';
  if (combo.includes('invalid-api-key')) return 'API key inválida (checar variáveis no deploy).';
  if (combo.includes('password_does_not_meet_requirements')) return 'Sua senha não atende à política definida.';
  return 'Não foi possível entrar. Verifique os dados e tente novamente.';
}

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').toLowerCase();

// espera condicao virar true com timeout
async function waitFor(cond: () => boolean, ms = 8000, step = 120) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const t = window.setInterval(() => {
      if (cond()) {
        window.clearInterval(t);
        resolve();
      } else if (Date.now() - start > ms) {
        window.clearInterval(t);
        reject(new Error('recaptcha-not-ready'));
      }
    }, step);
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const recaptchaRef = useRef<RecaptchaV2Handle>(null);

  useEffect(() => {
    console.info('BUILD_TAG', 'login-public-getToken-v2');
  }, []);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (loading) return;

    setErro('');
    setLoading(true);

    const mail = normalizeEmail(email);

    try {
      // BYPASS opcional (diagnóstico)
      if (process.env.NEXT_PUBLIC_LOGIN_BYPASS_RECAPTCHA === 'true') {
        await signInWithEmailAndPassword(auth, mail, senha);
        router.replace('/produtos');
        return;
      }

      // 1) garante que o widget está pronto antes de pedir token
      await waitFor(() => !!recaptchaRef.current && recaptchaRef.current.isReady());

      // 2) obtém token (e força watcher interno)
      const token = await recaptchaRef.current!.getToken();
      if (!token) throw new Error('token-vazio');

      // 3) valida token no backend
      const vr = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'login' }),
      });
      const vj = await vr.json().catch(() => ({} as unknown));
      if (!(vr.ok && (vj as { success?: boolean })?.success)) {
        console.warn('verify-recaptcha FAIL', { status: vr.status, body: vj });
        setErro('Falha na verificação do reCAPTCHA.');
        return;
      }

      // 4) login Firebase
      const cred = await signInWithEmailAndPassword(auth, mail, senha);

      // 5) cria/atualiza doc básico do usuário
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
            papel: 'cliente',
            ativo: true,
            criadoEm: serverTimestamp(),
          },
          { merge: true }
        );
      }

      router.replace('/produtos');
    } catch (e: unknown) {
      // narrowing seguro
      const err = (e ?? {}) as { code?: string; message?: string; name?: string };
      console.error('LOGIN ERROR', err.code ?? err.name, err.message ?? e);

      if (err.message === 'recaptcha-not-ready') {
        setErro('reCAPTCHA não ficou pronto. Atualize a página e tente novamente.');
      } else if (err.message === 'token-vazio') {
        setErro('Não foi possível obter o token do reCAPTCHA.');
      } else {
        setErro(mapAuthError(err.code, err.message));
      }
    } finally {
      setLoading(false);
      recaptchaRef.current?.reset();
    }
  };

  const handleGoogle = async () => {
    setErro('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(auth, provider);
      const user = res.user;

      const ref = doc(db, 'usuarios', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            uid: user.uid,
            email: normalizeEmail(user.email || email || ''),
            nome: user.displayName || '',
            celular: user.phoneNumber || '',
            telefoneVerificado: !!user.phoneNumber,
            papel: 'cliente',
            ativo: true,
            provedor: 'google',
            criadoEm: serverTimestamp(),
          },
          { merge: true }
        );
      }
      router.replace('/produtos');
    } catch (e: unknown) {
      const err = (e ?? {}) as { code?: string; message?: string };
      console.error('GOOGLE LOGIN ERROR', err.code, err.message ?? e);
      const c = String(err.code || '').toLowerCase();
      if (c.includes('popup-blocked')) setErro('Pop-up bloqueado. Desative o bloqueador e tente novamente.');
      else if (c.includes('popup-closed-by-user')) setErro('Pop-up fechado antes de concluir.');
      else if (c.includes('account-exists-with-different-credential')) setErro('Este e-mail já existe com outro método. Use o método original.');
      else setErro('Erro ao entrar com Google.');
    } finally {
      setLoading(false);
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
          inputMode="email"
        />

        <div className="relative mb-4">
          <input
            type={mostrarSenha ? 'text' : 'password'}
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="w-full p-3 pr-12 text-black placeholder-gray-500 bg-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
          onClick={handleGoogle}
          disabled={loading}
          className="flex items-center justify-center w-full gap-2 py-2 mt-3 font-semibold text-white transition bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5 bg-white rounded-full p-0.5"
          />
          Entrar com Google
        </button>

        <p className="mt-6 text-sm text-center">
          Ainda não tem uma conta?{' '}
          <a href="/cadastro" className="text-yellow-400 hover:underline">Cadastrar</a>
        </p>
      </form>

      {/* reCAPTCHA invisível — com getToken + espera de readiness */}
      <RecaptchaV2Invisible ref={recaptchaRef} />
    </main>
  );
}
