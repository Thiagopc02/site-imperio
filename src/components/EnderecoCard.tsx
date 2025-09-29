'use client';

import React from 'react';

type Endereco = {
  id?: string;
  rua: string;
  bairro: string;
  numero: string;
  complemento?: string;
  cep: string;
  cidade: string;
  pontoReferencia?: string;
};

type Props = {
  endereco: Endereco;
  selecionado: boolean;
  onSelecionar: () => void;
  onExcluir: () => void;
};

export default function EnderecoCard({
  endereco,
  selecionado,
  onSelecionar,
  onExcluir,
}: Props) {
  return (
    <div
      className={`p-3 rounded border transition-all ${
        selecionado
          ? 'border-yellow-500 bg-zinc-800'
          : 'border-zinc-700 bg-zinc-900'
      }`}
    >
      <p className="text-sm font-semibold">
        {endereco.rua}, {endereco.numero} - {endereco.bairro}, {endereco.cidade} - {endereco.cep}
      </p>
      {endereco.complemento && (
        <p className="text-sm text-gray-300">Compl.: {endereco.complemento}</p>
      )}
      {endereco.pontoReferencia && (
        <p className="text-sm text-gray-400">Ref.: {endereco.pontoReferencia}</p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          onClick={onSelecionar}
          className="px-3 py-1 text-sm font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500"
        >
          Selecionar
        </button>
        <button
          onClick={() => {
            const confirmar = confirm('Tem certeza que deseja excluir este endereço?');
            if (confirmar) onExcluir();
          }}
          className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
