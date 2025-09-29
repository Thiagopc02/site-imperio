'use client';
import { useEffect, useState } from 'react';

interface InputCepProps {
  value: string;
  onChange: (value: string) => void;
  setCidade?: (cidade: string) => void;
  setUf?: (uf: string) => void;
  setCepValido?: (valido: boolean) => void;
}

export default function InputCep({ value, onChange, setCidade, setUf, setCepValido }: InputCepProps) {
  const [mensagem, setMensagem] = useState('');

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numero = e.target.value.replace(/\D/g, '');
    let formatado = numero;
    if (numero.length >= 5) {
      formatado = numero.replace(/^(\d{5})(\d{0,3})/, '$1-$2');
    }
    onChange(formatado);
  };

  useEffect(() => {
    const cepLimpo = value.replace(/\D/g, '');

    if (setCepValido) {
      setCepValido(cepLimpo === '73840000');
    }

    if (cepLimpo.length === 8) {
      fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.erro) {
            setCidade?.(data.localidade);
            setUf?.(data.uf);
            setMensagem(`${data.localidade} - ${data.uf}`);
          } else {
            setMensagem('CEP não encontrado');
            setCidade?.('');
            setUf?.('');
          }
        })
        .catch(() => {
          setMensagem('Erro ao buscar CEP');
          setCidade?.('');
          setUf?.('');
        });
    } else {
      setMensagem('');
      setCidade?.('');
      setUf?.('');
    }
  }, [value, setCidade, setUf, setCepValido]);

  return (
    <div>
      <input
        placeholder="CEP (ex: 00000-000)"
        value={value}
        onChange={handleInput}
        className="input-style"
        maxLength={9}
      />
      {mensagem && (
        <p className="mt-1 ml-1 text-sm text-zinc-400">{mensagem}</p>
      )}
    </div>
  );
}
