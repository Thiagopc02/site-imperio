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

// ===== Allowlist fixa (normalizada) =====
const ADMIN_EMAILS = new Set<string>(
  [
    'thiagotorres5517@gmail.com',
    'thiagotorresdeoliveira9@gmail.com',
  ].map((e) =>
    e.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()
  )
);

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();

// ===== Consulta papel no Firestore (somente leitura) =====
async function hasAdminRole(uid: string) {
  // Preferência: coleção "administrador"
  try {
    const ref = doc(db, 'administrador', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d: any = snap.data();
      if (d?.papel === 'administrador' || d?.role === 'admin' || d?.ativo === true) return true;
    }
  } catch {}

  // Fallback: coleção "usuarios"
  try {
    const refU = doc(db, 'usuarios', uid);
    const snapU = await getDoc(refU);
    if (snapU.exists()) {
      const d: any = snapU.data();
      if (d?.papel === 'administrador' || d?.role === 'admin') return true;
    }
  } catch {}

  return false;
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const recaptchaRef = useRef<RecaptchaV2Handle>(null);
  const nextHandler = useRef<((t: string) => Promise<void>) | null>(null);

  // Observa a sessão (mesma instância usada no site todo)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const mail = normalizeEmail(u.email || '');
      if (ADMIN_EMAILS.has(mail) || (await hasAdminRole(u.uid))) {
        router.replace('/admin/dashboard');
      } else {
        await signOut(auth); // bloqueia logins que não são admin
      }
    });
    return () => unsub();
  }, [router]);

  async function verifyCaptchaOnServer(token: string) {
    const r = await fetch('/api/verify-recaptcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const j = await r.json();
    if (!j?.success) throw new Error('Falha na verificação do reCAPTCHA.');
  }

  async function ensureAdminOrThrow(user: User) {
    const mail = normalizeEmail(user.email || '');
    if (ADMIN_EMAILS.has(mail)) return;
    if (await hasAdminRole(user.uid)) return;
    await signOut(auth);
    throw new Error('Esta conta não tem acesso administrativo.');
  }

  // Fluxo e-mail + senha
  async function doEmailPassword() {
    setErro(null);
    setLoading(true);
    try {
      const mail = normalizeEmail(email);

      nextHandler.current = async (token: string) => {
        await verifyCaptchaOnServer(token);
        const cred = await signInWithEmailAndPassword(auth, mail, senha);
        await ensureAdminOrThrow(cred.user);
        router.replace('/admin/dashboard');
      };

      recaptchaRef.current?.execute();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao fazer login.');
      setLoading(false);
    }
  }

  const onVerify = async (token: string) => {
    try {
      if (nextHandler.current) await nextHandler.current(token);
    } catch (e: any) {
      const code: string = e?.code || '';
      const msg: string = e?.message || String(e);

      if (/auth\/wrong-password|INVALID_PASSWORD|invalid-credential/i.test(code + msg))
        setErro('Senha incorreta.');
      else if (/auth\/user-not-found|EMAIL_NOT_FOUND/i.test(code + msg))
        setErro('Conta não encontrada para este e-mail.');
      else if (/auth\/invalid-email|INVALID_EMAIL|missing-email/i.test(code + msg))
        setErro('E-mail inválido.');
      else
        setErro(msg);
    } finally {
      setLoading(false);
      nextHandler.current = null;
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
            if (!loading) doEmailPassword();
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
