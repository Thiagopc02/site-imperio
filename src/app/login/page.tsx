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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const recaptchaRef = useRef<RecaptchaV2Handle>(null);
  const pending = useRef<{ email: string; senha: string } | null>(null);

  useEffect(() => {
    console.info('BUILD_TAG', 'login-public-v2');
  }, []);

  const onVerify = async (token: string) => {
    try {
      if (!pending.current) return;
      // 1) valida token no backend
      const r = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'login' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!(r.ok && data?.success)) {
        setErro('Falha na verificação do reCAPTCHA.');
        return;
      }

      // 2) login Firebase
      const { email: em, senha: pw } = pending.current;
      const cred = await signInWithEmailAndPassword(auth, em, pw);

      // 3) cria doc básico se não existir
      const ref = doc(db, 'usuarios', cred.user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            uid: cred.user.uid,
            email: cred.user.email || em,
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
      console.error('LOGIN ERROR:', e?.code, e?.message ?? e);
      setErro(mapAuthError(e?.code, e?.message));
    } finally {
      setLoading(false);
      pending.current = null;
      recaptchaRef.current?.reset();
    }
  };

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

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (loading) return;

    setErro('');
    setLoading(true);

    const mail = normalizeEmail(email);

    // BYPASS opcional (diagnóstico): defina a var na Vercel se quiser testar só Firebase
    if (process.env.NEXT_PUBLIC_LOGIN_BYPASS_RECAPTCHA === 'true') {
      try {
        await signInWithEmailAndPassword(auth, mail, senha);
        router.replace('/produtos');
      } catch (e: any) {
        console.error('LOGIN (bypass) ERROR', e?.code, e?.message);
        setErro(mapAuthError(e?.code, e?.message));
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      pending.current = { email: mail, senha };
      await executeRecaptchaOrFail(); // onVerify continua o fluxo
    } catch (e) {
      console.warn('[recaptcha] execute falhou:', e);
      setErro('Não foi possível validar o reCAPTCHA. Atualize a página e tente novamente.');
      setLoading(false);
      pending.current = null;
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
    } catch (e: any) {
      console.error('GOOGLE LOGIN ERROR', e?.code, e?.message ?? e);
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
          onClick={handleGoogle}
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

      <RecaptchaV2Invisible ref={recaptchaRef} onVerify={onVerify} />
    </main>
  );
}
