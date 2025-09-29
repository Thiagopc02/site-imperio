'use client';

import React from 'react';

interface InputCpfCnpjProps {
  value: string;
  onChange: (value: string) => void;
  cep: string; // Recebe diretamente o CEP para validação
}

const InputCpfCnpj: React.FC<InputCpfCnpjProps> = ({ value, onChange, cep }) => {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');

    let formattedValue = rawValue;

    if (rawValue.length <= 11) {
      // Formato CPF
      formattedValue = rawValue
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1-$2');
    } else {
      // Formato CNPJ
      formattedValue = rawValue
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }

    onChange(formattedValue);
  };

  const isOptional = cep === '73840-000';

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d*"
        placeholder="CPF ou CNPJ (ex: 000.000.000-00 ou 00.000.000/0000-00)"
        value={value}
        onChange={handleInput}
        className="input-style"
        maxLength={18}
        aria-label="CPF ou CNPJ"
        required={!isOptional}
      />
      {isOptional && (
        <p className="mt-1 ml-1 text-sm text-yellow-400">
          Campo opcional para o CEP informado.
        </p>
      )}
    </div>
  );
};

export default InputCpfCnpj;
