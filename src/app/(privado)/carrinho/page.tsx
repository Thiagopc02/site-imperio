'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebase/config';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { useCart } from '@/context/CartContext';

type ProdutoCarrinho = {
  id: string;
  nome: string;
  imagem: string;
  quantidade: number;
  preco: number;
  tipo?: string;
};

type Endereco = {
  id?: string;
  rua: string;
  bairro: string;
  numero: string;
  complemento?: string;
  cep: string;
  cidade: string;
  pontoReferencia?: string;
  usuarioId: string;
  // opcionais (quando usuário usa GPS)
  lat?: number;
  lng?: number;
  accuracy?: number;
};

export default function CarrinhoPage() {
  const {
    carrinho,
    adicionarAoCarrinho,
    removerDoCarrinho,
    diminuirQuantidade,
    limparCarrinho,
  } = useCart() as { carrinho: ProdutoCarrinho[] } & ReturnType<typeof useCart>;

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'entrega' | 'retirada'>('retirada');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [locStatus, setLocStatus] = useState<string>('');

  const [novoEndereco, setNovoEndereco] = useState<Endereco>({
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    cep: '',
    complemento: '',
    pontoReferencia: '',
    usuarioId: '',
  });

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState<
    'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | ''
  >('');
  const [cartaoSubtipo, setCartaoSubtipo] = useState<'credito' | 'debito' | ''>('');
  const [troco, setTroco] = useState<string>('');

  const auth = getAuth();
  const user = auth.currentUser;
  const router = useRouter();

  const total = carrinho.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

  // ========= Endereços do usuário =========
  useEffect(() => {
    if (!user) return;
    setNovoEndereco((prev) => ({ ...prev, usuarioId: user.uid }));

    const q = query(collection(db, 'enderecos'), where('usuarioId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Endereco[] = [];
      snapshot.forEach((docu) => lista.push({ id: docu.id, ...docu.data() } as Endereco));
      setEnderecos(lista);
    });
    return () => unsubscribe();
  }, [user]);

  const buscarCidadePorCep = async (cep: string) => {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setNovoEndereco((prev) => ({
          ...prev,
          cidade: data.localidade || '',
          bairro: data.bairro || '',
          rua: data.logradouro || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  async function detectarLocalizacao() {
    if (!('geolocation' in navigator)) {
      setLocStatus('Seu navegador não suporta geolocalização.');
      return;
    }
    setLocStatus('Solicitando localização…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setNovoEndereco((prev) => ({
          ...prev,
          lat: latitude,
          lng: longitude,
          accuracy,
        }));
        setLocStatus('Localização capturada com sucesso ✅');
      },
      (err) => {
        console.error(err);
        setLocStatus('Não foi possível obter sua localização. Verifique permissões.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  const salvarEndereco = async () => {
    try {
      if (!user) {
        alert('Usuário não autenticado.');
        return;
      }
      const { rua, numero, bairro, cidade, cep } = novoEndereco;
      if (!cep || !rua || !numero || !bairro || !cidade) {
        alert('Preencha todos os campos obrigatórios do endereço.');
        return;
      }
      if (enderecos.length >= 3) {
        alert('Você só pode salvar até 3 endereços.');
        return;
      }
      const enderecoParaSalvar = { ...novoEndereco, usuarioId: user.uid, ativo: true };
      await addDoc(collection(db, 'enderecos'), enderecoParaSalvar);
      alert('Endereço salvo com sucesso!');
      setNovoEndereco({
        rua: '',
        numero: '',
        bairro: '',
        cidade: '',
        cep: '',
        complemento: '',
        pontoReferencia: '',
        usuarioId: user.uid,
      });
      setMostrarFormulario(false);
      setLocStatus('');
    } catch (error) {
      console.error('Erro ao salvar endereço:', error);
      alert('Erro ao salvar endereço.');
    }
  };

  const excluirEndereco = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este endereço?')) return;
    try {
      await deleteDoc(doc(db, 'enderecos', id));
      if (enderecoSelecionado === id) setEnderecoSelecionado('');
    } catch (error) {
      console.error('Erro ao excluir endereço:', error);
    }
  };

  // ========= Finalização local (dinheiro) =========
  const finalizarPedido = async () => {
    if (!nome || !telefone) return alert('Preencha nome e telefone.');
    if (!tipoEntrega) return alert('Selecione o tipo de entrega.');
    if (!formaPagamento) return alert('Selecione a forma de pagamento.');
    if (formaPagamento === 'dinheiro' && !troco) return alert('Informe o valor do troco.');

    let enderecoObj: Endereco | null = null;
    if (tipoEntrega === 'entrega') {
      if (!enderecoSelecionado) return alert('Selecione um endereço para entrega.');
      enderecoObj = enderecos.find((end) => end.id === enderecoSelecionado) || null;
      if (!enderecoObj) return alert('Endereço inválido.');
    }

    const pedido = {
      uid: user?.uid || '',
      nome,
      telefone,
      tipoEntrega,
      formaPagamento, // 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'
      troco: formaPagamento === 'dinheiro' ? Number(troco) || null : null,
      endereco: enderecoObj,
      itens: carrinho.map((item) => ({
        id: item.id,
        nome: item.nome,
        tipo: item.tipo || 'unidade',
        quantidade: item.quantidade,
        preco: item.preco,
      })),
      total,
      data: new Date().toISOString(),
      status: 'Em andamento',
    };

    try {
      await addDoc(collection(db, 'pedidos'), pedido);
      limparCarrinho();
      router.push('/pedidos');
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      alert('Erro ao finalizar pedido.');
    }
  };

  // ========= Iniciar pagamento MP (Pix/Cartão) =========
  const gerarExternalRef = () =>
    `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const irParaPagamentoMP = async () => {
    try {
      if (carrinho.length === 0) {
        alert('Seu carrinho está vazio.');
        return;
      }
      if (!['pix', 'cartao_credito', 'cartao_debito'].includes(formaPagamento)) {
        alert('Selecione Pix ou Cartão para pagar online.');
        return;
      }

      const endEntrega =
        tipoEntrega === 'entrega'
          ? enderecos.find((e) => e.id === enderecoSelecionado)
          : null;

      const externalRef = gerarExternalRef();

      const body = {
        items: carrinho.map((item) => ({
          title: item.nome,
          quantity: item.quantidade,
          unit_price: Number(item.preco),
          currency_id: 'BRL',
        })),
        payer: {
          name: nome || 'Cliente',
          email: (user as any)?.email || 'sandbox@test.com',
          phone: { number: telefone?.replace(/\D/g, '')?.slice(-11) || '' },
        },
        external_reference: externalRef,
        shipment: endEntrega
          ? {
              receiver_address: {
                zip_code: endEntrega.cep,
                street_name: `${endEntrega.rua}, ${endEntrega.numero}`,
                city_name: endEntrega.cidade,
              },
            }
          : undefined,
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_SITE_URL}/pedidos`,
          failure: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout-bricks?status=failure`,
          pending: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout-bricks?status=pending`,
        },
      };

      const res = await fetch('/api/mp/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error('Erro ao criar preference:', t);
        alert('Falha ao criar preferência de pagamento.');
        return;
      }

      const data = await res.json();
      const prefId = data?.id || data?.preferenceId;
      if (!prefId) {
        alert('Preferência criada sem ID.');
        return;
      }

      router.push(`/checkout-bricks?pref_id=${prefId}`);
    } catch (e) {
      console.error(e);
      alert('Erro ao iniciar o pagamento.');
    }
  };

  // ========= util =========
  const formatarTelefone = (valor: string) => {
    const cleaned = valor.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    return match ? `(${match[1]}) ${match[2]}-${match[3]}` : valor;
  };

  // ========= UI =========
  return (
    <main className="min-h-screen px-4 py-8 text-white bg-black">
      <div className="max-w-3xl mx-auto">
        <h1 className="mb-6 text-3xl font-bold">🛒 Seu Carrinho</h1>

        {/* Lista do carrinho */}
        {carrinho.length === 0 ? (
          <p className="text-gray-400">Seu carrinho está vazio.</p>
        ) : (
          <div className="mb-8 space-y-4">
            {carrinho.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex items-center justify-between p-4 rounded shadow bg-neutral-900"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={`/produtos/${item.imagem}`}
                    alt={item.nome}
                    className="object-contain w-16 h-16 rounded"
                  />
                  <div>
                    <p className="text-lg font-semibold">{item.nome}</p>
                    <p className="text-sm italic text-gray-300">
                      Tipo: {item.tipo || 'unidade'}
                    </p>
                    <p className="text-gray-400">Qtd: {item.quantidade}</p>
                    <p className="font-bold text-yellow-400">
                      R$ {(item.preco * item.quantidade).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 text-black bg-yellow-500 rounded hover:bg-yellow-600"
                    onClick={() => diminuirQuantidade(item.id)}
                  >
                    −
                  </button>
                  <button
                    className="px-2 text-black bg-yellow-500 rounded hover:bg-yellow-600"
                    onClick={() => adicionarAoCarrinho({ ...item, quantidade: 1 })}
                  >
                    +
                  </button>
                  <button
                    className="px-3 py-1 text-white bg-red-600 rounded hover:bg-red-700"
                    onClick={() => removerDoCarrinho(item.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dados do cliente */}
        <input
          type="text"
          placeholder="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full p-2 mb-2 text-black rounded"
        />
        <input
          type="text"
          placeholder="Telefone"
          value={telefone}
          onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
          className="w-full p-2 mb-4 text-black rounded"
        />

        {/* Tipo de entrega */}
        <div className="mb-4">
          <label className="block mb-1 font-semibold">Tipo de entrega:</label>
          <div className="flex gap-4">
            <button
              onClick={() => setTipoEntrega('retirada')}
              className={`px-4 py-2 rounded ${
                tipoEntrega === 'retirada' ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-white'
              }`}
            >
              🏪 Retirar no estabelecimento
            </button>
            <button
              onClick={() => setTipoEntrega('entrega')}
              className={`px-4 py-2 rounded ${
                tipoEntrega === 'entrega' ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-white'
              }`}
            >
              🚚 Receber em casa
            </button>
          </div>
        </div>

        {/* Entrega: endereços / novo endereço */}
        {tipoEntrega === 'entrega' && (
          <div className="mb-4">
            {enderecos.length > 0 && (
              <div className="space-y-2">
                {enderecos.map((endereco) => (
                  <div
                    key={endereco.id}
                    className={`p-3 rounded border ${
                      enderecoSelecionado === endereco.id
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
                    {typeof endereco.lat === 'number' && typeof endereco.lng === 'number' && (
                      <p className="mt-1 text-xs text-emerald-300">
                        📍 Localização salva ({endereco.lat.toFixed(5)}, {endereco.lng.toFixed(5)})
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setEnderecoSelecionado(endereco.id || '')}
                        className="px-3 py-1 text-sm font-semibold text-black bg-yellow-400 rounded"
                      >
                        Selecionar
                      </button>
                      <button
                        onClick={() => excluirEndereco(endereco.id!)}
                        className="px-3 py-1 text-sm text-white bg-red-600 rounded"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mostrarFormulario || enderecos.length === 0 ? (
              <div className="p-4 mt-4 border border-yellow-500 rounded bg-zinc-900">
                <p className="mb-2 text-yellow-400">Preencha o novo endereço:</p>
                {['cep', 'rua', 'numero', 'bairro', 'cidade', 'complemento', 'pontoReferencia'].map((campo) => (
                  <input
                    key={campo}
                    type="text"
                    placeholder={campo.charAt(0).toUpperCase() + campo.slice(1).replace(/([A-Z])/g, ' $1')}
                    value={novoEndereco[campo as keyof Endereco] ?? ''}
                    onChange={(e) => setNovoEndereco((prev) => ({ ...prev, [campo]: e.target.value }))}
                    onBlur={() => {
                      if (campo === 'cep' && novoEndereco.cep.replace(/\D/g, '').length === 8) {
                        buscarCidadePorCep(novoEndereco.cep.replace(/\D/g, ''));
                      }
                    }}
                    className="w-full p-2 mb-2 text-black rounded"
                  />
                ))}

                {/* Geolocalização */}
                <div className="p-2 mt-2 rounded bg-zinc-800">
                  <button
                    onClick={detectarLocalizacao}
                    className="px-3 py-2 text-sm font-semibold text-black rounded bg-emerald-400 hover:bg-emerald-500"
                  >
                    📍 Usar minha localização (GPS)
                  </button>
                  {locStatus && <p className="mt-2 text-xs text-gray-300">{locStatus}</p>}
                  {typeof novoEndereco.lat === 'number' && typeof novoEndereco.lng === 'number' && (
                    <>
                      <p className="mt-2 text-xs text-emerald-300">
                        Coordenadas: {novoEndereco.lat.toFixed(5)}, {novoEndereco.lng.toFixed(5)}
                      </p>
                      <iframe
                        title="Prévia do mapa"
                        src={`https://www.google.com/maps?q=${novoEndereco.lat},${novoEndereco.lng}&z=17&output=embed`}
                        width="100%"
                        height="180"
                        style={{ border: 0 }}
                        loading="lazy"
                        className="mt-2 rounded"
                      />
                    </>
                  )}
                </div>

                <button
                  onClick={salvarEndereco}
                  className="w-full py-2 mt-3 font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500"
                >
                  Salvar Endereço
                </button>
              </div>
            ) : (
              enderecos.length < 3 && (
                <button
                  onClick={() => setMostrarFormulario(true)}
                  className="px-4 py-2 mt-4 text-sm font-semibold text-blue-400 border border-blue-400 rounded hover:bg-blue-900"
                >
                  + Adicionar novo endereço
                </button>
              )
            )}
          </div>
        )}

        {/* Retirada: info com mapa fixo da loja */}
        {tipoEntrega === 'retirada' && (
          <div className="p-4 mb-4 rounded bg-zinc-800">
            <p className="mb-2 font-medium text-green-400">Você optou por retirar no estabelecimento.</p>
            <div className="text-sm text-white">
              <p><strong>Império Bebidas e Tabacos</strong></p>
              <p>R. Temístocles Rocha, Qd. 07 - Lt. 01, Nº 56</p>
              <p>Setor Central – Campos Belos – GO | CEP 73840-000</p>
              <p><strong>Ref.:</strong> Próximo à Câmara Municipal</p>

              <a
                href="https://www.google.com/maps?q=-13.034359,-46.775423"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 mt-2 text-sm font-semibold text-white bg-yellow-500 rounded hover:bg-yellow-600"
              >
                <img src="/google-maps-icon.png" alt="Google Maps" className="w-5 h-5" />
                Ver no Google Maps
              </a>

              <iframe
                title="Localização da Império Bebidas e Tabacos"
                src="https://www.google.com/maps?q=-13.034359,-46.775423&z=18&output=embed"
                width="100%"
                height="200"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="mt-2 rounded"
              />
            </div>
          </div>
        )}

        {/* Forma de pagamento */}
        <div className="mb-4">
          <label className="block mb-2 font-semibold">Forma de pagamento:</label>

          <div className="flex flex-wrap items-center gap-3">
            {/* PIX */}
            <button
              onClick={() => { setFormaPagamento('pix'); setCartaoSubtipo(''); }}
              className={[
                'px-4 py-2 rounded-full text-sm font-medium transition',
                'border border-zinc-600/60 hover:border-yellow-400/70',
                formaPagamento === 'pix'
                  ? 'bg-yellow-400 text-black shadow-[0_0_0_3px_rgba(234,179,8,0.25)]'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              ].join(' ')}
              aria-pressed={formaPagamento === 'pix'}
            >
              🔳 PIX
            </button>

            {/* Cartão + subopções */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const novoSub = cartaoSubtipo || 'credito';
                  setCartaoSubtipo(novoSub);
                  setFormaPagamento(novoSub === 'credito' ? 'cartao_credito' : 'cartao_debito');
                }}
                className={[
                  'px-4 py-2 rounded-full text-sm font-medium transition',
                  'border border-zinc-600/60 hover:border-yellow-400/70',
                  formaPagamento.startsWith('cartao')
                    ? 'bg-yellow-400 text-black shadow-[0_0_0_3px_rgba(234,179,8,0.25)]'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                ].join(' ')}
                aria-pressed={formaPagamento.startsWith('cartao')}
              >
                💳 Cartão
              </button>

              {formaPagamento.startsWith('cartao') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCartaoSubtipo('credito'); setFormaPagamento('cartao_credito'); }}
                    className={[
                      'px-3 py-2 rounded-full text-xs font-semibold transition',
                      'border border-sky-700/60',
                      cartaoSubtipo === 'credito'
                        ? 'bg-sky-400 text-black shadow-[0_0_0_3px_rgba(56,189,248,0.25)]'
                        : 'bg-sky-900 text-white hover:bg-sky-800'
                    ].join(' ')}
                  >
                    Crédito
                  </button>
                  <button
                    onClick={() => { setCartaoSubtipo('debito'); setFormaPagamento('cartao_debito'); }}
                    className={[
                      'px-3 py-2 rounded-full text-xs font-semibold transition',
                      'border border-sky-700/60',
                      cartaoSubtipo === 'debito'
                        ? 'bg-sky-400 text-black shadow-[0_0_0_3px_rgba(56,189,248,0.25)]'
                        : 'bg-sky-900 text-white hover:bg-sky-800'
                    ].join(' ')}
                  >
                    Débito
                  </button>
                </div>
              )}
            </div>

            {/* Dinheiro */}
            <button
              onClick={() => { setFormaPagamento('dinheiro'); setCartaoSubtipo(''); }}
              className={[
                'px-4 py-2 rounded-full text-sm font-medium transition',
                'border border-zinc-600/60 hover:border-yellow-400/70',
                formaPagamento === 'dinheiro'
                  ? 'bg-yellow-400 text-black shadow-[0_0_0_3px_rgba(234,179,8,0.25)]'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              ].join(' ')}
              aria-pressed={formaPagamento === 'dinheiro'}
            >
              💵 Dinheiro
            </button>
          </div>
        </div>

        {formaPagamento === 'dinheiro' && (
          <input
            type="number"
            placeholder="Troco para quanto?"
            value={troco}
            onChange={(e) => setTroco(e.target.value)}
            className="w-full p-2 mb-4 text-black border rounded border-zinc-300"
          />
        )}

        {/* Total e botões */}
        <p className="mb-4 text-lg font-bold">Total: R$ {total.toFixed(2)}</p>

        {carrinho.length > 0 && (
          <div className="grid gap-3">
            {formaPagamento === 'dinheiro' ? (
              <button
                onClick={finalizarPedido}
                className="w-full py-3 text-lg font-semibold text-white bg-green-600 rounded hover:bg-green-700"
              >
                Finalizar Pedido (pagar na entrega)
              </button>
            ) : (
              <button
                onClick={irParaPagamentoMP}
                className="w-full py-3 text-lg font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-500"
              >
                Ir para pagamento (Mercado Pago)
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
