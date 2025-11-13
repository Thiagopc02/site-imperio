'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/firebase/config';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { useCart } from '@/context/CartContext';

/* ===================== Tipos ===================== */
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
  lat?: number;
  lng?: number;
  accuracy?: number;
};

// Tipagem local do contexto do carrinho
type CartContextShape = {
  carrinho: ProdutoCarrinho[];
  adicionarAoCarrinho: (p: ProdutoCarrinho) => void;
  removerDoCarrinho: (id: string) => void;
  diminuirQuantidade: (id: string) => void;
  limparCarrinho: () => void;
};

/* ===================== Página ===================== */
export default function CarrinhoPage() {
  const {
    carrinho,
    adicionarAoCarrinho,
    removerDoCarrinho,
    diminuirQuantidade,
    limparCarrinho,
  } = useCart() as CartContextShape;

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'entrega' | 'retirada'>('retirada');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [locStatus, setLocStatus] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  // Pagamento: toggle entre dinheiro x online (Mercado Pago)
  const [pagarComDinheiro, setPagarComDinheiro] = useState<boolean>(false);
  const [troco, setTroco] = useState<string>('');

  const auth = getAuth();
  const router = useRouter();

  // total memoizado
  const total = useMemo(
    () => carrinho.reduce((acc, item) => acc + item.preco * item.quantidade, 0),
    [carrinho]
  );

  // Lê usuário e assina endereços
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid ?? null;
      setUserId(uid);
      setUserEmail(u?.email ?? null);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    setNovoEndereco((prev) => ({ ...prev, usuarioId: userId }));

    const qy = query(collection(db, 'enderecos'), where('usuarioId', '==', userId));
    const unsubscribe = onSnapshot(qy, (snapshot: QuerySnapshot<DocumentData>) => {
      const lista: Endereco[] = [];
      snapshot.forEach((docu) =>
        lista.push({ id: docu.id, ...(docu.data() as Omit<Endereco, 'id'>) })
      );
      setEnderecos(lista);
    });
    return () => unsubscribe();
  }, [userId]);

  /* ===================== Helpers ===================== */
  const formatarTelefone = (valor: string) => {
    const cleaned = valor.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    return match ? `(${match[1]}) ${match[2]}-${match[3]}` : valor;
  };

  const handleNovoEnderecoChange =
    (campo: keyof Endereco) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setNovoEndereco((prev) => ({ ...prev, [campo]: value }));
    };

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

  /* ===================== Endereço: salvar/excluir ===================== */
  const salvarEndereco = async () => {
    try {
      if (!userId) {
        alert('Você precisa estar logado para salvar endereços.');
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
      const enderecoParaSalvar = { ...novoEndereco, usuarioId: userId, ativo: true };
      await addDoc(collection(db, 'enderecos'), enderecoParaSalvar);
      setNovoEndereco({
        rua: '',
        numero: '',
        bairro: '',
        cidade: '',
        cep: '',
        complemento: '',
        pontoReferencia: '',
        usuarioId: userId,
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

  /* ===================== Finalização local (dinheiro) ===================== */
  const finalizarPedidoDinheiro = async () => {
    if (carrinho.length === 0) return alert('Seu carrinho está vazio.');
    if (!nome || !telefone) return alert('Preencha nome e telefone.');
    if (!tipoEntrega) return alert('Selecione o tipo de entrega.');
    if (troco.trim() === '') return alert('Informe o valor do troco (ou 0 se não precisar).');

    let enderecoObj: Endereco | null = null;
    if (tipoEntrega === 'entrega') {
      if (!enderecoSelecionado) return alert('Selecione um endereço para entrega.');
      enderecoObj = enderecos.find((end) => end.id === enderecoSelecionado) || null;
      if (!enderecoObj) return alert('Endereço inválido.');
    }

    const pedido = {
      uid: userId || '',
      nome,
      telefone,
      tipoEntrega,
      formaPagamento: 'dinheiro' as const,
      troco: Number(troco || '0'),
      endereco: enderecoObj,
      itens: carrinho.map((item) => ({
        id: item.id,
        nome: item.nome,
        tipo: item.tipo || 'unidade',
        quantidade: item.quantidade,
        preco: item.preco,
      })),
      total,
      data: serverTimestamp(),            //  <-- Timestamp correto
      atualizadoEm: serverTimestamp(),
      status: 'Em andamento',
      mpPaymentId: null as string | null, // preenchido se migrar para online
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

  /* ===================== Iniciar pagamento MP (online) ===================== */
  const gerarExternalRef = () =>
    `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const irParaPagamentoMP = async () => {
    try {
      if (carrinho.length === 0) {
        alert('Seu carrinho está vazio.');
        return;
      }
      if (!nome || !telefone) {
        alert('Preencha nome e telefone.');
        return;
      }

      const endEntrega =
        tipoEntrega === 'entrega'
          ? enderecos.find((e) => e.id === enderecoSelecionado)
          : null;

      const externalRef = gerarExternalRef();

      // rascunho do pedido (será atualizado via webhook)
      const pedidoRascunho = {
        uid: userId || '',
        nome,
        telefone,
        tipoEntrega,
        formaPagamento: 'online' as const, // definido no Checkout
        troco: null as number | null,
        endereco: endEntrega ?? null,
        itens: carrinho.map((item) => ({
          id: item.id,
          nome: item.nome,
          tipo: item.tipo || 'unidade',
          quantidade: item.quantidade,
          preco: item.preco,
        })),
        total,
        data: serverTimestamp(),         //  <-- Timestamp correto
        atualizadoEm: serverTimestamp(),
        status: 'Aguardando pagamento',
        external_reference: externalRef, //  <-- lido pelo webhook
        mpPaymentId: null as string | null,
      };

      await setDoc(doc(db, 'pedidos', externalRef), pedidoRascunho, { merge: true });

      // guarda informações para a página /checkout-bricks compor a preferência/pagamento
      if (typeof window !== 'undefined') {
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        localStorage.setItem('mp_external_reference', externalRef);
        if (userEmail) localStorage.setItem('mp_payer_email', userEmail);
        localStorage.setItem('pedido_nome', nome);
        localStorage.setItem('pedido_telefone', telefone);
        localStorage.setItem('pedido_total', String(total));
        localStorage.setItem('pedido_tipoEntrega', tipoEntrega);
      }

      router.push('/checkout-bricks');
    } catch (e) {
      console.error(e);
      alert('Erro ao iniciar o pagamento.');
    }
  };

  /* ===================== UI ===================== */
  return (
    <main className="min-h-screen px-4 py-8 text-white bg-black">
      <div className="max-w-3xl mx-auto">
        <h1 className="mb-6 text-3xl font-bold">🛒 Seu Carrinho</h1>

        {carrinho.length === 0 ? (
          <p className="text-gray-400">Seu carrinho está vazio.</p>
        ) : (
          <div className="mb-8 space-y-4">
            {carrinho.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex items-center justify-between p-4 transition shadow-sm rounded-xl bg-neutral-900/80 ring-1 ring-white/10 hover:ring-yellow-500/40"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={`/produtos/${item.imagem || 'sem-imagem.png'}`}
                    alt={item.nome}
                    className="object-contain w-16 h-16 rounded bg-zinc-800"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/sem-imagem.png';
                    }}
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)}
          className="w-full p-3 mb-2 text-black rounded-lg"
        />
        <input
          type="text"
          placeholder="Telefone"
          value={telefone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTelefone(formatarTelefone(e.target.value))
          }
          className="w-full p-3 mb-4 text-black rounded-lg"
        />

        {/* Tipo de entrega */}
        <div className="mb-4">
          <label className="block mb-1 font-semibold">Tipo de entrega:</label>
          <div className="flex gap-4">
            <button
              onClick={() => setTipoEntrega('retirada')}
              className={`px-4 py-2 rounded-lg ${
                tipoEntrega === 'retirada' ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-white'
              }`}
            >
              🏪 Retirar no estabelecimento
            </button>
            <button
              onClick={() => setTipoEntrega('entrega')}
              className={`px-4 py-2 rounded-lg ${
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
                    className={`p-3 rounded-xl ring-1 ${
                      enderecoSelecionado === endereco.id
                        ? 'ring-yellow-500 bg-zinc-800'
                        : 'ring-white/10 bg-zinc-900'
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
              <div className="p-4 mt-4 rounded-xl ring-1 ring-yellow-500 bg-zinc-900">
                <p className="mb-2 text-yellow-400">Preencha o novo endereço:</p>
                {(['cep', 'rua', 'numero', 'bairro', 'cidade', 'complemento', 'pontoReferencia'] as const).map(
                  (campo) => (
                    <input
                      key={campo}
                      type="text"
                      placeholder={campo
                        .charAt(0)
                        .toUpperCase() + campo.slice(1).replace(/([A-Z])/g, ' $1')}
                      value={String(novoEndereco[campo] ?? '')}
                      onChange={handleNovoEnderecoChange(campo)}
                      onBlur={() => {
                        if (campo === 'cep') {
                          const cepLimpo = String(novoEndereco.cep ?? '').replace(/\D/g, '');
                          if (cepLimpo.length === 8) buscarCidadePorCep(cepLimpo);
                        }
                      }}
                      className="w-full p-3 mb-2 text-black rounded-lg"
                    />
                  )
                )}

                {/* Geolocalização */}
                <div className="p-3 mt-2 rounded-lg bg-zinc-800">
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
                  className="w-full py-3 mt-3 font-semibold text-black bg-yellow-400 rounded-lg hover:bg-yellow-500"
                >
                  Salvar Endereço
                </button>
              </div>
            ) : (
              enderecos.length < 3 && (
                <button
                  onClick={() => setMostrarFormulario(true)}
                  className="px-4 py-2 mt-4 text-sm font-semibold text-blue-400 border border-blue-400 rounded-lg hover:bg-blue-900"
                >
                  + Adicionar novo endereço
                </button>
              )
            )}
          </div>
        )}

        {/* Retirada: info com mapa fixo da loja */}
        {tipoEntrega === 'retirada' && (
          <div className="p-4 mb-6 rounded-xl bg-zinc-800 ring-1 ring-white/10">
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
        <div className="mb-6">
          <label className="block mb-2 font-semibold">Forma de pagamento:</label>

          {/* Alternador: Dinheiro x Online */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPagarComDinheiro(false)}
              className={[
                'px-4 py-2 rounded-full text-sm font-medium transition',
                'border border-sky-700/60',
                !pagarComDinheiro
                  ? 'bg-sky-500 text-black shadow-[0_0_0_3px_rgba(59,130,246,0.25)]'
                  : 'bg-sky-900 text-white hover:bg-sky-800',
              ].join(' ')}
              aria-pressed={!pagarComDinheiro}
              title="Pix / Cartão Crédito ou Débito / Boleto (Mercado Pago)"
            >
              💠 Pagar Online (Mercado Pago)
            </button>

            <button
              onClick={() => setPagarComDinheiro(true)}
              className={[
                'px-4 py-2 rounded-full text-sm font-medium transition',
                'border border-yellow-600/60',
                pagarComDinheiro
                  ? 'bg-yellow-400 text-black shadow-[0_0_0_3px_rgba(234,179,8,0.25)]'
                  : 'bg-yellow-900 text-white hover:bg-yellow-700',
              ].join(' ')}
              aria-pressed={pagarComDinheiro}
            >
              💵 Pagar na Entrega (Dinheiro)
            </button>
          </div>
        </div>

        {/* Bloco explicativo (ONLINE) */}
        {!pagarComDinheiro && (
          <div className="p-5 mb-6 text-center rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-950 ring-1 ring-white/10">
            <p className="text-sm/6">
              <strong>Pagar com PIX / Cartão Crédito ou Débito / Boleto</strong><br />
              Você escolhe o método na próxima etapa (Checkout do Mercado Pago).
            </p>

            <div className="flex flex-wrap items-center justify-center mt-4 gap-x-4 gap-y-3 opacity-90 hover:opacity-100">
              <img src="/pix-carrinho.png" alt="Pix" className="h-6" />
              <img src="/visa-carrinho.png" alt="Visa" className="h-6" />
              <img src="/mastercard-carrinho.png" alt="Mastercard" className="h-6" />
              <img src="/elo-carrinho.png" alt="Elo" className="h-6" />
              <img src="/hipercard-carrinho.svg" alt="Hipercard" className="h-6" />
              <img src="/american-express-carrinho.svg" alt="American Express" className="h-6" />
              <img src="/boleto-carrinho.svg" alt="Boleto" className="h-6" />
            </div>
          </div>
        )}

        {/* Quando é dinheiro, pede troco */}
        {pagarComDinheiro && (
          <div className="mb-6">
            <input
              type="number"
              placeholder="Troco para quanto?"
              value={troco}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTroco(e.target.value)}
              className="w-full p-3 mb-2 text-black border rounded-lg border-zinc-300"
            />
            <p className="text-xs text-zinc-400">
              Se não precisar de troco, informe <strong>0</strong>.
            </p>
          </div>
        )}

        {/* Total e CTA ÚNICO */}
        <div className="sticky z-10 bottom-4">
          <div className="p-3 rounded-xl bg-zinc-900/80 ring-1 ring-white/10 backdrop-blur">
            <p className="mb-3 text-lg font-bold">
              Total: <span className="text-yellow-400">R$ {total.toFixed(2)}</span>
            </p>

            {carrinho.length > 0 && (
              <button
                onClick={pagarComDinheiro ? finalizarPedidoDinheiro : irParaPagamentoMP}
                className={[
                  'w-full py-3 text-lg font-semibold rounded-lg transition',
                  pagarComDinheiro
                    ? 'text-white bg-green-600 hover:bg-green-700'
                    : 'text-white bg-sky-500 hover:bg-sky-600',
                ].join(' ')}
                title={pagarComDinheiro ? 'Finalizar e pagar em dinheiro na entrega' : 'Ir para o Checkout do Mercado Pago'}
              >
                {pagarComDinheiro
                  ? 'Finalizar Pedido (pagar na entrega)'
                  : 'Ir para Pagamento (Mercado Pago)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
