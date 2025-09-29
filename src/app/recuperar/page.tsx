'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { useRouter } from 'next/navigation';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem('');
    setErro('');

    try {
      await sendPasswordResetEmail(auth, email);
      setMensagem('Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
    } catch {
      setErro('Não foi possível enviar o e-mail. Verifique o endereço informado.');
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen px-4 text-white bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 rounded-lg shadow-lg bg-neutral-900"
      >
        <h1 className="mb-4 text-3xl font-bold text-center text-yellow-400">
          Recuperar Senha
        </h1>

        <p className="mb-4 text-sm text-center text-gray-300">
          Informe seu e-mail para receber um link de redefinição de senha.
        </p>

        {mensagem && (
          <p className="mb-4 text-sm text-center text-green-400">{mensagem}</p>
        )}
        {erro && (
          <p className="mb-4 text-sm text-center text-red-500">{erro}</p>
        )}

        <label className="block mb-6">
          <span className="text-sm">E-mail</span>
          <input
            type="email"
            className="w-full p-2 mt-1 text-black bg-white rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          className="w-full py-2 font-semibold text-black transition bg-yellow-400 rounded hover:bg-yellow-500"
        >
          Enviar link de recuperação
        </button>

        <p className="mt-6 text-sm text-center">
          Lembrou a senha?{' '}
          <a href="/login" className="text-yellow-400 hover:underline">
            Voltar para o login
          </a>
        </p>
      </form>
    </main>
  );
}
