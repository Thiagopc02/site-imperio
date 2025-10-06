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

type PendingCreds = { email: string; senha: string } | null;

function mapAuthError(code?: string, message?: string) {
  if (!code && message?.includes('PASSWORD_DOES_NOT_MEET_REQUIREMENTS')) {
    return 'Sua senha não atende à política (maiúscula, minúscula, número e especial). Atualize a senha.';
  }
  const c = String(code || '').toLowerCase();
  if (c.includes('invalid-email')) return 'E-mail inválido.';
  if (c.includes('user-disabled')) return 'Usuário desativado.';
  if (c.includes('user-not-found')) return 'Conta não encontrada. Cadastre-se.';
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'Senha incorreta.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Tente novamente em instantes.';
  if (c.includes('network-request-failed')) return 'Falha de rede. Verifique sua conexão.';
  if (c.includes('invalid-api-key')) return 'API key inválida. Verifique as variáveis do deploy.';
  return 'Não foi possível entrar. Verifique os dados e tente novamente.';
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const recaptchaRef = useRef<RecaptchaV2Handle>(null);
  const pendingCreds = useRef<PendingCreds>(null);

  useEffect(() => {
    // Log útil para confirmar que o build novo está no ar
    if (typeof window !== 'undefined') {
      console.info('BUILD_TAG', 'login-v2-2025-10-06');
    }
  }, []);

  const normalizeEmail = (raw: string) =>
    raw
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._%+\-@]/g, '')
      .trim();

  /** Callback do reCAPTCHA INVISÍVEL após gerar o token */
  const onVerify = async (token: string) => {
    try {
      if (!pendingCreds.current) {
        console.debug('[login] onVerify ignorado (sem pendingCreds)');
        return;
      }
      if (!token) {
        setErro('Falha ao obter o token do reCAPTCHA.');
        return;
      }

      // 1) Valida token no backend
      let ok = false;
      try {
        const resp = await fetch('/api/verify-recaptcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'login' }),
        });
        const data = await resp.json().catch(() => ({}));
        ok = resp.ok && !!data?.success;
        if (!ok) {
          setErro('Falha na verificação do reCAPTCHA.');
          return;
        }
      } catch (e) {
        console.warn('[verify-recaptcha] erro de rede:', e);
        setErro('Falha ao validar o reCAPTCHA. Tente novamente.');
        return;
      }

      // 2) Faz login no Firebase
      const { email: mail, senha: pass } = pendingCreds.current;
      const cred = await signInWithEmailAndPassword(auth, mail, pass);

      // 3) Garante doc mínimo do usuário no Firestore
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
    } catch (e: any) {
      console.error('[login] error:', e?.code, e?.message ?? e);
      setErro(mapAuthError(e?.code, e?.message));
    } finally {
      setLoading(false);
      pendingCreds.current = null;
      recaptchaRef.current?.reset();
    }
  };

  /** Executa o widget invisível (espera ficar pronto) */
  const executeRecaptchaOrFail = async () => {
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (recaptchaRef.current?.isReady?.()) {
          try {
            recaptchaRef.current.execute();
            resolve();
          } catch (e) {
            reject(e);
          }
          return;
        }
        if (Date.now() - start > 6000) {
          reject(new Error('reCAPTCHA não ficou pronto a tempo'));
          return;
        }
        setTimeout(tick, 150);
      };
      tick();
    });
  };

  /** Submit → salva credenciais e dispara o reCAPTCHA invisível */
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (loading) return;

    setErro('');
    setLoading(true);

    const mail = normalizeEmail(email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setLoading(false);
      setErro('E-mail inválido.');
      return;
    }

    pendingCreds.current = { email: mail, senha };

    try {
      await executeRecaptchaOrFail();
    } catch (e) {
      console.warn('[recaptcha] execute falhou:', e);
      setErro('Não foi possível validar o reCAPTCHA. Atualize a página e tente novamente.');
      setLoading(false);
      pendingCreds.current = null;
    }
  };

  /** Login com Google */
  const handleGoogleSignIn = async () => {
    setErro('');
    setLoading(true);
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
            papel: 'cliente',
            ativo: true,
            provedor: 'google',
            criadoEm: serverTimestamp(),
          },
          { merge: true }
        );
      }
      router.replace('/produtos');
    } catch (e: any) {
      console.error('[google] error:', e?.code, e?.message ?? e);
      const c = String(e?.code || '').toLowerCase();
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
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center justify-center w-full gap-2 py-2 mt-3 font-semibold text-white transition bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
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
          <a href="/cadastro" className="text-yellow-400 hover:underline">Cadastrar</a>
        </p>
      </form>

      {/* Widget invisível — dispara onVerify(token) */}
      <RecaptchaV2Invisible ref={recaptchaRef} onVerify={onVerify} />
    </main>
  );
}
