'use client';

import { useEffect, useMemo, useState } from 'react';
import { db, auth } from '@/firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

type PedidoItem = {
  id: string;
  nome: string;
  imagem?: string;
  tipo?: string;
  quantidade: number;
  preco: number;
};

type Endereco = {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  complemento?: string;
  pontoReferencia?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
};

type Pedido = {
  id: string;
  uid: string;
  nome: string;
  telefone: string;
  tipoEntrega: 'entrega' | 'retirada';
  formaPagamento: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';
  troco?: number | null;
  endereco?: Endereco | null;
  itens: PedidoItem[];
  total: number;
  data: any; // ISO ou Timestamp
  status: 'Em andamento' | 'Confirmado' | 'Em rota' | 'Entregue' | 'Cancelado' | string;
};

type Range = 'hoje' | 'duas_semanas' | 'quinze_dias' | 'um_mes' | 'todos';

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const toDate = (v: any): Date => {
  if (!v) return new Date(NaN);
  if (typeof v === 'string') return new Date(v);
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
};

const money = (n: number) => `R$ ${Number(n || 0).toFixed(2)}`;

function fmtPagamento(fp: Pedido['formaPagamento']) {
  switch (fp) {
    case 'pix': return '🔳 PIX';
    case 'cartao_credito': return '💳 Cartão • Crédito';
    case 'cartao_debito': return '💳 Cartão • Débito';
    case 'dinheiro': return '💵 Dinheiro';
    default: return '—';
  }
}

function badgeStatus(status: string) {
  const base = 'px-2 py-0.5 rounded-full text-xs font-semibold';
  if (/entregue/i.test(status)) return `${base} bg-green-600 text-white`;
  if (/rota/i.test(status))     return `${base} bg-blue-600 text-white`;
  if (/confirm/i.test(status))  return `${base} bg-emerald-600 text-white`;
  if (/cancel/i.test(status))   return `${base} bg-red-600 text-white`;
  return `${base} bg-yellow-500 text-black`;
}

const badgeEntrega = (tipo: Pedido['tipoEntrega']) =>
  tipo === 'retirada'
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-700 text-yellow-300">🏪 Retirada</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-700 text-yellow-300">🚚 Entrega</span>;

function enderecoTexto(e?: Endereco | null) {
  if (!e) return '';
  return [e.rua, e.numero, e.bairro, e.cidade, e.cep, 'Brasil'].filter(Boolean).join(', ');
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [usuarioLogado, setUsuarioLogado] = useState<User | null>(null);
  const [range, setRange] = useState<Range>('todos');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUsuarioLogado(null);
        setPedidos([]);
        return;
      }
      setUsuarioLogado(user);

      const pedidosQuery = query(collection(db, 'pedidos'), where('uid', '==', user.uid));
      const unsubscribeSnapshot = onSnapshot(pedidosQuery, (snapshot) => {
        const lista: Pedido[] = [];
        snapshot.forEach((doc) => lista.push({ id: doc.id, ...(doc.data() as any) }));
        lista.sort((a, b) => toDate(b.data).getTime() - toDate(a.data).getTime());
        setPedidos(lista);
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

  const filteredPedidos = useMemo(() => {
    if (!pedidos.length) return [];
    if (range === 'todos') return pedidos;

    const now = new Date();
    if (range === 'hoje') return pedidos.filter((p) => isSameLocalDay(toDate(p.data), now));

    let inicio = 0;
    if (range === 'duas_semanas') { const d = new Date(); d.setDate(d.getDate() - 14); inicio = d.getTime(); }
    else if (range === 'quinze_dias') { const d = new Date(); d.setDate(d.getDate() - 15); inicio = d.getTime(); }
    else if (range === 'um_mes') { const d = new Date(); d.setMonth(d.getMonth() - 1); inicio = d.getTime(); }

    return pedidos.filter((p) => toDate(p.data).getTime() >= inicio);
  }, [pedidos, range]);

  const RangeButton = ({ value, children }: { value: Range; children: React.ReactNode }) => (
    <button
      onClick={() => setRange(value)}
      className={[
        'px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition border',
        range === value
          ? 'bg-yellow-400 text-black border-yellow-500 shadow-[0_0_0_3px_rgba(234,179,8,0.25)]'
          : 'bg-zinc-800 text-white border-zinc-600 hover:bg-zinc-700'
      ].join(' ')}
      aria-pressed={range === value}
    >
      {children}
    </button>
  );

  return (
    <div className="max-w-4xl min-h-screen p-4 mx-auto text-white bg-black">
      <h1 className="mb-6 text-3xl font-bold text-center text-yellow-400">📦 Meus Pedidos</h1>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        <RangeButton value="hoje">Hoje</RangeButton>
        <RangeButton value="duas_semanas">2 semanas</RangeButton>
        <RangeButton value="quinze_dias">15 dias</RangeButton>
        <RangeButton value="um_mes">1 mês</RangeButton>
        <RangeButton value="todos">Todos</RangeButton>
      </div>

      <p className="mb-4 text-sm text-center text-gray-400">
        Mostrando <span className="font-medium text-yellow-300">{filteredPedidos.length}</span> pedido(s)
        {range !== 'todos' && <> no período selecionado</>}
      </p>

      {filteredPedidos.length === 0 ? (
        <p className="text-center text-gray-400">Nenhum pedido encontrado nesse período.</p>
      ) : (
        <div className="space-y-6">
          {filteredPedidos.map((pedido) => {
            const hasCoords =
              typeof pedido.endereco?.lat === 'number' &&
              typeof pedido.endereco?.lng === 'number';

            // monta URLs para botão/iframe (coords -> preferencial; senão, endereço textual)
            const addrText = enderecoTexto(pedido.endereco);
            const mapHref = hasCoords
              ? `https://www.google.com/maps?q=${pedido.endereco!.lat},${pedido.endereco!.lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrText)}`;
            const iframeSrc = hasCoords
              ? `https://www.google.com/maps?q=${pedido.endereco!.lat},${pedido.endereco!.lng}&z=16&output=embed`
              : `https://www.google.com/maps?q=${encodeURIComponent(addrText)}&z=16&output=embed`;

            return (
              <div key={pedido.id} className="p-4 border border-yellow-700 shadow-md rounded-xl bg-zinc-900/80">
                {/* Cabeçalho */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-700">
                  <div className="space-y-0.5">
                    <p className="text-lg font-semibold">
                      Pedido <span className="text-yellow-400">#{pedido.id}</span>
                    </p>
                    <p className="text-sm text-gray-400">Data: {toDate(pedido.data).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {badgeEntrega(pedido.tipoEntrega)}
                    <span className={badgeStatus(pedido.status)}>{pedido.status}</span>
                  </div>
                </div>

                {/* Itens */}
                <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
                  {pedido.itens?.map((item, idx) => {
                    const src = item.imagem ? `/produtos/${item.imagem}` : '/sem-imagem.png';
                    const subtotal = item.preco * item.quantidade;
                    return (
                      <div key={`${item.id}-${idx}`} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/70">
                        <img src={src} alt={item.nome} className="object-contain w-16 h-16 rounded bg-zinc-900" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.nome}</p>
                          <p className="text-xs text-gray-400">
                            {item.tipo || 'unidade'} • Qtd: {item.quantidade}
                          </p>
                          <p className="text-sm font-semibold text-yellow-300">{money(subtotal)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé */}
                <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p>
                      Pagamento{' '}
                      <span className="font-medium text-yellow-300">{fmtPagamento(pedido.formaPagamento)}</span>
                      {pedido.formaPagamento === 'dinheiro' && typeof pedido.troco === 'number' && (
                        <> • Troco para: <span className="text-white">{money(pedido.troco)}</span></>
                      )}
                    </p>

                    {pedido.tipoEntrega === 'entrega' && pedido.endereco && (
                      <>
                        <p className="text-gray-300">
                          Endereço: {pedido.endereco.rua}, {pedido.endereco.numero} - {pedido.endereco.bairro}{' '}
                          ({pedido.endereco.cidade}) {pedido.endereco.cep ? `• CEP ${pedido.endereco.cep}` : ''}
                          {typeof pedido.endereco.accuracy === 'number' && (
                            <> • precisão ~{Math.round(pedido.endereco.accuracy)} m</>
                          )}
                        </p>

                        {/* Mapa: usa coords se houver; senão, endereço textual */}
                        {addrText && (
                          <div className="mt-2 space-y-2">
                            <a
                              href={mapHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-3 py-1 text-xs font-semibold text-black rounded bg-emerald-400 hover:bg-emerald-500"
                            >
                              📍 Ver no mapa
                            </a>
                            <iframe
                              title={`Mapa do pedido ${pedido.id}`}
                              src={iframeSrc}
                              width="100%"
                              height="180"
                              style={{ border: 0 }}
                              loading="lazy"
                              className="rounded"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm">Total</p>
                    <p className="text-2xl font-extrabold text-green-400">{money(pedido.total)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
