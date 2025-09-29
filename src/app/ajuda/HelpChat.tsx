'use client';

import { useMemo, useState } from 'react';
import { FaPaperPlane, FaTrash } from 'react-icons/fa';

type ActionLink = { label: string; href: string; external?: boolean };
type Message = { role: 'user' | 'bot'; text: string; ts: number; actions?: ActionLink[] };

/** FAQs (respostas rápidas) */
const FAQ_DB: Array<{ q: string; a: string; tags: string[] }> = [
  {
    q: 'Horário de funcionamento',
    a: 'Funcionamento: Domingo a Quinta das 06:30 às 00:00; Sexta e Sábado das 06:30 às 02:00.',
    tags: ['horário', 'funcionamento', 'abre', 'fecha', 'atendimento'],
  },
  {
    q: 'Formas de pagamento',
    a: 'Aceitamos cartão de crédito/débito e Pix.',
    tags: ['pagamento', 'pix', 'cartão', 'pagar', 'boleto'],
  },
  {
    q: 'Prazo de entrega',
    a: 'Entregas locais geralmente chegam no mesmo dia. Para outras regiões, o prazo aparece no checkout.',
    tags: ['prazo', 'entrega', 'frete', 'quando chega'],
  },
  {
    q: 'Trocas e devoluções',
    a: 'Se houver qualquer problema, fale com a gente no WhatsApp: (62) 99691-6206.',
    tags: ['troca', 'devolução', 'suporte', 'defeito'],
  },
  {
    q: 'Contato',
    a: 'Você pode falar conosco pelo WhatsApp: (62) 99691-6206 ou pela página "Fale Conosco".',
    tags: ['contato', 'whatsapp', 'telefone', 'atendimento', 'fale conosco'],
  },
];

/** Intenções -> links do site */
function intentLinks(q: string): ActionLink[] {
  const s = q.toLowerCase();

  // compras / navegação de catálogo
  if (
    s.includes('quero comprar') ||
    s.includes('comprar') ||
    s.includes('produtos') ||
    s.includes('ver produtos')
  ) {
    return [{ label: 'Ver produtos', href: '/produtos' }];
  }
  if (s.includes('categoria') || s.includes('categorias')) {
    return [{ label: 'Ver categorias', href: '/categorias' }];
  }

  // fluxo de conta
  if (s.includes('login') || s.includes('entrar')) {
    return [{ label: 'Ir para Login', href: '/login' }];
  }
  if (s.includes('cadastro') || s.includes('cadastrar')) {
    return [{ label: 'Criar conta', href: '/cadastro' }];
  }
  if (s.includes('carrinho') || s.includes('sacola')) {
    return [{ label: 'Abrir carrinho', href: '/carrinho' }];
  }

  // institucionais / políticas
  if (s.includes('sobre') || s.includes('sobre nós') || s.includes('empresa')) {
    return [{ label: 'Sobre nós', href: '/sobre-nos' }];
  }
  if (s.includes('termo') || s.includes('termos')) {
    return [{ label: 'Termos de uso', href: '/termos' }];
  }
  if (s.includes('privacidade') || s.includes('lgpd') || s.includes('dados')) {
    return [{ label: 'Política de Privacidade', href: '/privacidade' }];
  }
  if (s.includes('contato') || s.includes('fale conosco') || s.includes('suporte')) {
    return [
      { label: 'Fale Conosco', href: '/contato' },
      { label: 'WhatsApp', href: 'https://wa.me/5562996916206', external: true },
    ];
  }

  // palavras “comerciais” genéricas
  if (s.includes('whisky') || s.includes('vodka') || s.includes('cigarro') || s.includes('charuto')) {
    return [{ label: 'Ver produtos', href: '/produtos' }];
  }

  return [];
}

/** Recupera melhor resposta do FAQ (simples) */
function bestAnswer(question: string): string {
  const q = question.toLowerCase();
  let best = FAQ_DB[0];
  let scoreBest = -1;

  for (const item of FAQ_DB) {
    let score = 0;
    for (const tag of item.tags) if (q.includes(tag)) score++;
    if (q.includes('horário') || q.includes('funcionamento')) score += 2;
    if (q.includes('pagamento') || q.includes('pix') || q.includes('cartão')) score += 2;
    if (q.includes('entrega') || q.includes('frete') || q.includes('prazo')) score += 2;
    if (q.includes('troca') || q.includes('devolução')) score += 2;
    if (q.includes('contato') || q.includes('whatsapp') || q.includes('telefone')) score += 2;
    if (score > scoreBest) {
      best = item;
      scoreBest = score;
    }
  }

  if (scoreBest <= 0) {
    return `Não tenho certeza, mas posso ajudar! Fale conosco no WhatsApp: (62) 99691-6206.`;
  }
  return best.a;
}

export default function HelpChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text:
        'Olá! Sou o assistente da Império. Posso ajudar com pedidos, entregas, pagamentos e políticas. Faça uma pergunta ou clique em um atalho abaixo 👇',
      ts: Date.now(),
      actions: [
        { label: 'Ver produtos', href: '/produtos' },
        { label: 'Ver categorias', href: '/categorias' },
        { label: 'Fale Conosco', href: '/contato' },
      ],
    },
  ]);
  const [input, setInput] = useState('');

  const shortcuts = useMemo(
    () => [
      'Qual o horário de atendimento?',
      'Quais formas de pagamento?',
      'Qual é o prazo de entrega?',
      'Como fazer trocas e devoluções?',
      'Como falar com o suporte?',
      'Quero comprar.',
      'Ver categorias.',
    ],
    []
  );

  function send(text: string) {
    if (!text.trim()) return;

    const clean = text.trim();
    setMessages((m) => [...m, { role: 'user', text: clean, ts: Date.now() }]);
    setInput('');

    setTimeout(() => {
      const links = intentLinks(clean);
      const answer = links.length ? 'Aqui está o que eu encontrei 👇' : bestAnswer(clean);
      setMessages((m) => [...m, { role: 'bot', text: answer, ts: Date.now(), actions: links }]);
    }, 300);
  }

  return (
    <div className="w-full max-w-3xl p-4 mx-auto rounded-xl bg-zinc-900">
      {/* atalhos */}
      <div className="flex flex-wrap gap-2 mb-3">
        {shortcuts.map((s, i) => (
          <button
            key={i}
            onClick={() => send(s)}
            className="px-3 py-1 text-sm transition rounded-full bg-zinc-800 hover:bg-zinc-700"
          >
            {s}
          </button>
        ))}
      </div>

      {/* janela do chat */}
      <div className="p-3 overflow-y-auto border rounded-lg h-72 bg-zinc-950/60 border-zinc-800">
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div
              className={`inline-block max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                m.role === 'user' ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-zinc-100'
              }`}
            >
              {m.text}
              {/* botões de ações (links) */}
              {m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.actions.map((a, k) => (
                    <a
                      key={k}
                      href={a.href}
                      target={a.external ? '_blank' : '_self'}
                      rel={a.external ? 'noopener noreferrer' : undefined}
                      className="px-3 py-1 text-xs font-semibold text-black transition bg-yellow-400 rounded-full hover:brightness-95"
                    >
                      {a.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* entrada */}
      <form
        className="flex items-center gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua pergunta…"
          className="flex-1 px-3 text-white border rounded-lg outline-none h-11 bg-zinc-800 border-zinc-700 focus:border-yellow-400"
        />
        <button
          type="submit"
          className="flex items-center gap-2 px-4 font-semibold text-black bg-yellow-400 rounded-lg h-11 hover:brightness-95"
        >
          <FaPaperPlane />
          Enviar
        </button>
        <button
          type="button"
          title="Limpar"
          onClick={() =>
            setMessages([
              {
                role: 'bot',
                text:
                  'Chat reiniciado. Como posso ajudar? Você pode perguntar sobre pagamento, entrega, trocas, contato, etc.',
                ts: Date.now(),
                actions: [
                  { label: 'Ver produtos', href: '/produtos' },
                  { label: 'Ver categorias', href: '/categorias' },
                  { label: 'Fale Conosco', href: '/contato' },
                ],
              },
            ])
          }
          className="grid rounded-lg w-11 h-11 place-items-center bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          <FaTrash />
        </button>
      </form>

      <div className="mt-2 text-xs text-zinc-400">
        Dica: para suporte humano imediato, chame no{' '}
        <a
          href="https://wa.me/5562996916206"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-400 hover:underline"
        >
          WhatsApp (62) 99691-6206
        </a>
        .
      </div>
    </div>
  );
}
