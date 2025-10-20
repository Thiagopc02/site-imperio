'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/firebase/config';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import InputCelular from '@/components/InputCelular';
import InputCep from '@/components/InputCep';
import InputCpfCnpj from '@/components/InputCpfCnpj';

export default function CadastroPage() {
  const router = useRouter();

  // ---------------- state ----------------
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');

  const [loadingCadastro, setLoadingCadastro] = useState(false);

  // --------------- helpers ----------------
  const toE164 = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('+')) return trimmed.replace(/\s+/g, '');
    const digits = trimmed.replace(/\D/g, '');
    // BR: se vier só dígitos, prefixa +55
    if (digits.length <= 13) return `+55${digits}`;
    return `+${digits}`;
  };

  const normEmail = (e: string) => e.trim().toLowerCase().replace(/\s+/g, '');

  // Pequenos type guards para evitar "any"
  type WithCode = { code?: unknown; message?: unknown };
  const hasCode = (x: unknown): x is WithCode =>
    typeof x === 'object' && x !== null && 'code' in x;

  type WithCustomDataEmail = { customData?: { email?: string } };
  const hasCustomDataEmail = (x: unknown): x is WithCustomDataEmail =>
    typeof x === 'object' && x !== null && 'customData' in x;

  // --------------- CEP -> cidade/UF ----------------
  const handleCep = async (cepDigitado: string) => {
    setCep(cepDigitado);
    const clean = cepDigitado.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data: { localidade?: string; uf?: string } = await resp.json();
        setCidade(data?.localidade || '');
        setUf(data?.uf || '');
      } catch {
        setCidade('');
        setUf('');
      }
    } else {
      setCidade('');
      setUf('');
    }
  };

  // --------------- regras para habilitar o botão Cadastrar ----------------
  const cepValido = cep.replace(/\D/g, '').length === 8 && !!cidade && !!uf;
  const senhasOk = senha.length >= 6 && senha === confirmarSenha;
  const formReady =
    !!nome.trim() &&
    !!normEmail(email) &&
    senhasOk &&
    cepValido &&
    !!telefone.trim();

  // --------------- cadastro por e-mail ----------------
  const handleCadastro = async () => {
    if (!formReady) return;

    try {
      setLoadingCadastro(true);

      const mail = normEmail(email);
      const cred = await createUserWithEmailAndPassword(auth, mail, senha);
      const user = cred.user;

      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        nome: nome.trim(),
        email: mail,
        celular: toE164(telefone), // salva o número informado (sem verificação)
        cep,
        cidade,
        uf,
        cpfcnpj: cpfCnpj || null,
        telefoneVerificado: false, // sem verificação por SMS
        papel: 'cliente',
        criadoEm: serverTimestamp(),
        ativo: true,
      });

      alert('Cadastro concluído com sucesso!');
      router.push('/login');
    } catch (error: unknown) {
      console.error('Erro ao cadastrar:', error);
      const code = hasCode(error)
        ? String(error.code || error.message || '')
        : String(error ?? '');

      if (code.includes('email-already-in-use')) {
        alert('Este e-mail já está em uso. Tente fazer login.');
      } else if (code.includes('permission') || code.includes('insufficient')) {
        alert('Sem permissão para salvar o perfil. Verifique regras e a coleção "usuarios".');
      } else {
        alert('Erro ao cadastrar. Tente novamente.');
      }
    } finally {
      setLoadingCadastro(false);
    }
  };

  // --------------- Google (mantido, sem mudanças) ----------------
  const cadastrarComGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;

      await setDoc(
        doc(db, 'usuarios', user.uid),
        {
          uid: user.uid,
          nome: user.displayName || nome || '',
          email: normEmail(user.email || email || ''),
          foto: user.photoURL || '',
          celular: user.phoneNumber || '',
          telefoneVerificado: !!user.phoneNumber,
          cep: cep || null,
          cidade: cidade || null,
          uf: uf || null,
          cpfcnpj: cpfCnpj || null,
          provedor: 'google',
          papel: 'cliente',
          criadoEm: serverTimestamp(),
          ativo: true,
        },
        { merge: true }
      );

      await signOut(auth);
      router.replace('/login?new=google');
    } catch (e: unknown) {
      console.error('Google sign-in error:', e);

      const code = hasCode(e) ? String(e.code || '') : '';
      if (code === 'auth/popup-blocked') {
        alert('Pop-up bloqueado. Desative o bloqueador e tente novamente.');
      } else if (code === 'auth/popup-closed-by-user') {
        alert('Pop-up fechado antes de concluir.');
      } else if (code === 'auth/account-exists-with-different-credential') {
        const em =
          hasCustomDataEmail(e) && e.customData ? e.customData.email : undefined;

        if (em) {
          const methods = await fetchSignInMethodsForEmail(auth, em);
          alert(`Este e-mail já existe com: ${methods.join(', ')}. Entre por lá e vincule depois.`);
        } else {
          alert('Este e-mail já está cadastrado com outro método de login.');
        }
      } else {
        alert('Não foi possível continuar com o Google. Tente novamente.');
      }
    }
  };

  // --------------- UI ----------------
  return (
    <main className="max-w-md p-6 mx-auto mt-10 text-white rounded shadow-md bg-zinc-900">
      <h1 className="mb-4 text-2xl font-bold text-center text-yellow-400">
        Criar Conta
      </h1>

      <form onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder="Nome completo"
          className="input-style"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <input
          type="email"
          placeholder="E-mail"
          className="input-style"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={(e) => setEmail(normEmail(e.target.value))}
        />

        {/* Senha */}
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            placeholder="Senha"
            className="pr-10 input-style"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute -translate-y-1/2 right-3 top-1/2 text-zinc-400 hover:text-zinc-200"
            aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
            title={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPwd ? '🙈' : '👁️'}
          </button>
        </div>

        {/* Confirmar senha */}
        <div className="relative">
          <input
            type={showPwd2 ? 'text' : 'password'}
            placeholder="Confirmar senha"
            className="pr-10 input-style"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPwd2((v) => !v)}
            className="absolute -translate-y-1/2 right-3 top-1/2 text-zinc-400 hover:text-zinc-200"
            aria-label={showPwd2 ? 'Ocultar senha' : 'Mostrar senha'}
            title={showPwd2 ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPwd2 ? '🙈' : '👁️'}
          </button>
        </div>

        <InputCep value={cep} onChange={handleCep} />

        <input
          type="text"
          className="input-style"
          value={cidade && uf ? `${cidade} - ${uf}` : '-'}
          disabled
        />

        <InputCpfCnpj value={cpfCnpj} onChange={setCpfCnpj} cep={cep} />

        {/* Telefone (aceita +55… ou outros DDIs) */}
        <InputCelular value={telefone} onChange={setTelefone} />

        {/* Botão Cadastrar: sempre visível; habilita só quando o formulário está pronto */}
        <button
          type="button"
          onClick={handleCadastro}
          disabled={!formReady || loadingCadastro}
          className="w-full py-3 mt-3 font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500 disabled:opacity-60"
          title={!formReady ? 'Preencha todos os campos corretamente' : 'Cadastrar'}
        >
          {loadingCadastro ? 'Cadastrando…' : 'Cadastrar'}
        </button>

        <button
          type="button"
          onClick={cadastrarComGoogle}
          className="flex items-center justify-center w-full gap-2 py-3 mt-4 font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          Cadastrar com Google
        </button>

        <div className="mt-4 text-sm text-center text-gray-300">
          Cidade: <strong>{cidade || '—'}</strong> — UF:{' '}
          <strong>{uf || '—'}</strong>
        </div>
      </form>
    </main>
  );
}
