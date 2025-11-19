'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

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
type AdminDoc = { papel?: string; role?: string; ativo?: boolean };
const isAdminDoc = (x: unknown): x is AdminDoc =>
  typeof x === 'object' && x !== null;

/** Checa papéis de admin em coleções conhecidas */
async function hasAdminRole(uid: string): Promise<boolean> {
  // Preferência: coleção "administrador"
  try {
    const ref = doc(db, 'administrador', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() as unknown;
      if (
        isAdminDoc(d) &&
        (d.papel === 'administrador' || d.role === 'admin' || d.ativo === true)
      ) {
        return true;
      }
    }
  } catch {
    /* noop */
  }

  // Fallback: coleção "usuarios"
  try {
    const refU = doc(db, 'usuarios', uid);
    const snapU = await getDoc(refU);
    if (snapU.exists()) {
      const d = snapU.data() as unknown;
      if (isAdminDoc(d) && (d.papel === 'administrador' || d.role === 'admin')) {
        return true;
      }
    }
  } catch {
    /* noop */
  }

  return false;
}

/** Extrai code/message com segurança de um erro desconhecido (sem `any`) */
function getErrInfo(e: unknown): { code?: string; message?: string } {
  if (typeof e === 'string') return { message: e };
  if (typeof e === 'object' && e !== null) {
    const rec = e as Record<string, unknown>;
    return {
      code: typeof rec.code === 'string' ? rec.code : undefined,
      message: typeof rec.message === 'string' ? rec.message : undefined,
    };
  }
  return {};
}

/** Mapeia mensagens amigáveis para códigos do Firebase/Identity Platform */
function mapAuthError(code?: string, message?: string) {
  const combo = `${code ?? ''} ${message ?? ''}`.toLowerCase();

  if (
    combo.includes('wrong-password') ||
    combo.includes('invalid-credential') ||
    combo.includes('invalid_password')
  )
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
  if (
    combo.includes('popup-closed-by-user') ||
    combo.includes('cancelled-popup-request')
  )
    return 'Login cancelado pelo usuário.';

  return 'Não foi possível entrar. Verifique os dados e tente novamente.';
}

/** Garante que o usuário logado é admin; caso contrário, encerra a sessão */
async function ensureAdminOrThrow(user: User) {
  const mail = normalizeEmail(user.email || '');
  if (ADMIN_EMAILS.has(mail)) return;
  if (await hasAdminRole(user.uid)) return;
  await signOut(auth);
  throw new Error('Esta conta não tem acesso administrativo.');
}

/** ====== PAGE ====== */
export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Marca do build para confirmar que o deploy novo está carregado
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.info('ADMIN_BUILD_TAG', 'admin-login-2025-11-18-google');
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

  /** Login por e-mail/senha (continua disponível) */
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

      const cred = await signInWithEmailAndPassword(auth, mail, senha);
      await ensureAdminOrThrow(cred.user);

      router.replace('/admin/dashboard');
    } catch (err: unknown) {
      const { code, message } = getErrInfo(err);
      console.error('ADMIN login error (email/senha):', code, message ?? err);
      setErro(mapAuthError(code, message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  /** Login com Google (para os e-mails liberados) */
  async function doGoogleLogin() {
    if (loading) return;
    setErro(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const cred = await signInWithPopup(auth, provider);
      await ensureAdminOrThrow(cred.user);

      router.replace('/admin/dashboard');
    } catch (err: unknown) {
      const { code, message } = getErrInfo(err);
      console.error('ADMIN login error (Google):', code, message ?? err);
      setErro(mapAuthError(code, message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen p-4 bg-black text-neutral-100">
      <div className="w-full max-w-md p-6 border shadow-xl rounded-2xl border-neutral-800 bg-neutral-900/60">
        <h1 className="mb-6 text-xl font-semibold text-center">Acesso Administrativo</h1>

        {erro && (
          <div className="p-3 mb-4 text-sm text-red-300 border rounded-lg border-red-500/40 bg-red-500/10">
            {erro}
          </div>
        )}

        {/* Login por e-mail/senha */}
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
            {loading ? 'Entrando…' : 'Entrar com e-mail/senha'}
          </button>
        </form>

        {/* Separador */}
        <div className="flex items-center my-5">
          <div className="flex-1 h-px bg-neutral-700" />
          <span className="px-3 text-xs text-neutral-400">ou</span>
          <div className="flex-1 h-px bg-neutral-700" />
        </div>

        {/* Login com Google */}
        <button
          type="button"
          onClick={() => void doGoogleLogin()}
          disabled={loading}
          className="inline-flex items-center justify-center w-full gap-3 px-4 py-2 text-sm font-medium bg-white rounded-xl text-neutral-900 hover:bg-neutral-100 disabled:opacity-60"
        >
          <span className="inline-flex items-center justify-center text-base font-bold bg-white border rounded-full w-7 h-7">
            G
          </span>
          <span>Entrar com Google</span>
        </button>
      </div>
    </main>
  );
}
