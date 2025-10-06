'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import RecaptchaV2Invisible, { RecaptchaV2Handle } from '@/components/RecaptchaV2Invisible';

/** ====== CONFIG ====== */
const ADMIN_EMAILS = new Set<string>(
  [
    'thiagotorres5517@gmail.com',
    'thiagotorresdeoliveira9@gmail.com',
  ].map((e) =>
    e.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()
  )
);

/** Normaliza e higieniza e-mail */
const normalizeEmail = (raw: string) =>
  raw
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();

/** ====== Firestore: verificação de papel ====== */
async function hasAdminRole(uid: string) {
  // Preferência: coleção "administrador"
  try {
    const ref = doc(db, 'administrador', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d: any = snap.data();
      if (d?.papel === 'administrador' || d?.role === 'admin' || d?.ativo === true) return true;
    }
  } catch {
    /* noop */
  }

  // Fallback: coleção "usuarios"
  try {
    const refU = doc(db, 'usuarios', uid);
    const snapU = await getDoc(refU);
    if (snapU.exists()) {
      const d: any = snapU.data();
      if (d?.papel === 'administrador' || d?.role === 'admin') return true;
    }
  } catch {
    /* noop */
  }

  return false;
}

/** Mapeia mensagens amigáveis para códigos do Firebase/Identity Platform */
function mapAuthError(code?: string, message?: string) {
  const combo = `${code ?? ''} ${message ?? ''}`.toLowerCase();

  if (combo.includes('wrong-password') || combo.includes('invalid-credential') || combo.includes('invalid_password'))
    return 'Senha incorreta.';
  if (combo.includes('user-not-found') || combo.includes('email_not_found'))
    return 'Conta não encontrada para este e-mail.';
  if (combo.includes('invalid-email') || combo.includes('missing-email'))
    return 'E-mail inválido.';
  if (combo.includes('too-many-requests'))
    return 'Muitas tentativas. Tente novamente em instantes.';
  if (combo.includes('network-request-failed'))
    return 'Falha de rede. Verifique sua conexão.';
  if (combo.includes('password_does_not_meet_requirements'))
    return 'Sua senha não atende à política definida. Atualize-a para continuar.';

  return 'Não foi possível entrar. Verifique os dados e tente novamente.';
}

/** ====== PAGE ====== */
export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const recaptchaRef = useRef<RecaptchaV2Handle>(null);
  const pending = useRef<{ email: string; senha: string } | null>(null);

  // Marca do build para confirmar que o deploy novo está carregado
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.info('ADMIN_BUILD_TAG', 'admin-login-2025-10-06');
    }
  }, []);

  // Observa a sessão e redireciona se já for admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const mail = normalizeEmail(u.email || '');
      const isAdmin = ADMIN_EMAILS.has(mail) || (await hasAdminRole(u.uid));
      console.info('ADMIN onAuthStateChanged', { user: u.email, isAdmin });

      if (isAdmin) {
        router.replace('/admin/dashboard');
      } else {
        await signOut(auth);
        setErro('Este usuário não tem acesso administrativo.');
      }
    });
    return () => unsub();
  }, [router]);

  /** Valida token do reCAPTCHA invisível no backend */
  async function verifyCaptchaOnServer(token: string) {
    const r = await fetch('/api/verify-recaptcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'admin-login' }),
    });
    const j = await r.json().catch(() => ({}));
    if (!(r.ok && j?.success)) {
      throw new Error('Falha na verificação do reCAPTCHA.');
    }
  }

  /** Garante que o usuário logado é admin; caso contrário, encerra a sessão */
  async function ensureAdminOrThrow(user: User) {
    const mail = normalizeEmail(user.email || '');
    if (ADMIN_EMAILS.has(mail)) return;
    if (await hasAdminRole(user.uid)) return;
    await signOut(auth);
    throw new Error('Esta conta não tem acesso administrativo.');
  }

  /** Executa o widget invisível com timeout e feedback */
  async function executeRecaptchaOrFail() {
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
      const step = () => {
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
          reject(new Error('reCAPTCHA não ficou pronto a tempo.'));
          return;
        }
        setTimeout(step, 150);
      };
      step();
    });
  }

  /** Submit: prepara credenciais, dispara reCAPTCHA e completa o login no callback */
  async function doEmailPassword() {
    if (loading) return;
    setErro(null);
    setLoading(true);

    try {
      const mail = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        throw new Error('E-mail inválido.');
      }
      if (senha.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      pending.current = { email: mail, senha };
      await executeRecaptchaOrFail(); // onVerify continua o fluxo
    } catch (e: any) {
      console.error('ADMIN doEmailPassword error:', e);
      setErro(mapAuthError(e?.code, e?.message ?? String(e)));
      setLoading(false);
      pending.current = null;
    }
  }

  /** Callback do reCAPTCHA invisível */
  const onVerify = async (token: string) => {
    try {
      if (!pending.current) return;

      // 1) valida reCAPTCHA no backend
      await verifyCaptchaOnServer(token);

      // 2) login Firebase
      const { email: em, senha: pw } = pending.current;
      const cred = await signInWithEmailAndPassword(auth, em, pw);

      // 3) garante permissão admin
      await ensureAdminOrThrow(cred.user);

      // 4) navega
      router.replace('/admin/dashboard');
    } catch (e: any) {
      console.error('ADMIN onVerify error:', e?.code, e?.message ?? e);
      setErro(mapAuthError(e?.code, e?.message ?? String(e)));
    } finally {
      setLoading(false);
      pending.current = null;
      recaptchaRef.current?.reset();
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen p-4 bg-black text-neutral-100">
      <div className="w-full max-w-md p-6 border shadow-xl rounded-2xl border-neutral-800 bg-neutral-900/60">
        <h1 className="mb-6 text-xl font-semibold text-center">Acesso Administrativo</h1>

        {erro && (
          <div className="p-3 mb-4 text-sm text-red-300 border rounded-lg border-red-500/40 bg-red-500/10">
            {erro}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doEmailPassword();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block mb-1 text-sm text-neutral-300">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => setEmail(normalizeEmail(e.target.value))}
              className="w-full px-3 py-2 outline-none rounded-xl bg-neutral-800 ring-1 ring-neutral-700 focus:ring-2 focus:ring-yellow-500"
              placeholder="admin@exemplo.com"
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-neutral-300">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-3 py-2 pr-10 outline-none rounded-xl bg-neutral-800 ring-1 ring-neutral-700 focus:ring-2 focus:ring-yellow-500"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((s) => !s)}
                className="absolute inset-y-0 grid right-2 place-items-center text-neutral-400 hover:text-neutral-200"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-medium text-black bg-yellow-500 rounded-xl hover:bg-yellow-400 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>

      {/* reCAPTCHA invisível */}
      <RecaptchaV2Invisible ref={recaptchaRef} onVerify={onVerify} />
    </main>
  );
}
