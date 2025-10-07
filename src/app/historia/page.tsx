// src/app/historia/page.tsx
import TimelineClient from "./timeline-client";

export const metadata = {
  title: "História das Marcas | Império",
  description:
    "Explore a linha do tempo de marcas icônicas. Começando pela Coca-Cola: marcos, curiosidades e capítulos que moldaram uma das marcas mais famosas do mundo.",
};

type TimelineEvent = {
  id: string;
  year: number;
  title: string;
  text: string;
  image?: string;
};

type Brand = {
  slug: string;
  name: string;
  logo: string;   // imagem circular do “balão”
  banner?: string;
  color: string;  // cor de destaque da marca
  events: TimelineEvent[];
};

export default function HistoriaPage() {
  // — Apenas Coca-Cola por enquanto —
  const cocaEvents: TimelineEvent[] = [
    {
      id: "coca-1886",
      year: 1886,
      title: "A fórmula nasce em Atlanta",
      text:
        "O farmacêutico John Pemberton cria a Coca-Cola na Jacob’s Pharmacy, servida inicialmente como tônico em fontes de soda.",
      image: "/produtos/coca-cola-2L.jpg",
    },
    {
      id: "coca-1892",
      year: 1892,
      title: "The Coca-Cola Company",
      text:
        "Asa Griggs Candler adquire direitos e funda oficialmente a The Coca-Cola Company, iniciando a expansão comercial.",
    },
    {
      id: "coca-1915",
      year: 1915,
      title: "A garrafa contour",
      text:
        "Nasce a icônica garrafa de curvas (“contour bottle”), criada para ser reconhecida até no escuro ou quebrada.",
    },
    {
      id: "coca-1931",
      year: 1931,
      title: "O Papai Noel vermelho",
      text:
        "As ilustrações de Haddon Sundblom para campanhas da marca ajudam a popularizar o visual moderno do Papai Noel.",
    },
    {
      id: "coca-1941",
      year: 1941,
      title: "Segunda Guerra Mundial",
      text:
        "A empresa promete fornecer Coca-Cola a US$ 0,05 a todos os soldados americanos, levando fábricas e a marca ao mundo.",
    },
    {
      id: "coca-1955",
      year: 1955,
      title: "Novos tamanhos & embalagens",
      text:
        "Chegam garrafas em diferentes tamanhos e, mais tarde, as versões em lata tornam o consumo ainda mais prático.",
    },
    {
      id: "coca-1961",
      year: 1961,
      title: "Sprite é lançada",
      text:
        "A família de produtos cresce com a Sprite, que se torna um dos refrigerantes de limão mais vendidos do planeta.",
    },
    {
      id: "coca-1985",
      year: 1985,
      title: "New Coke",
      text:
        "A tentativa de mudar a fórmula gera reação histórica dos consumidores. A marca traz de volta a ‘Coca-Cola Classic’.",
    },
    {
      id: "coca-2005",
      year: 2005,
      title: "Coca-Cola Zero",
      text:
        "Uma nova linha ‘zero açúcar’ expande o portfólio e atinge público que buscava sabor clássico com menos calorias.",
    },
    {
      id: "coca-2021",
      year: 2021,
      title: "Novos rótulos e foco em sustentabilidade",
      text:
        "A companhia renova design, simplifica portfólio global e acelera metas de reciclagem e redução de pegada ambiental.",
    },
  ];

  const brands: Brand[] = [
    {
      slug: "coca-cola",
      name: "Coca-Cola",
      logo: "/produtos/coca-cola-2L.jpg", // usa sua imagem já na pasta /public/produtos
      banner: "/produtos/coca-cola-2L.jpg",
      color: "#E10600",
      events: cocaEvents,
    },
  ];

  return (
    <main className="min-h-screen text-white bg-black">
      <section className="container py-10">
        <h1 className="mb-2 text-3xl font-bold text-center md:text-4xl">
          Histórias de Grandes Marcas
        </h1>
        <p className="max-w-3xl mx-auto text-center text-gray-300">
          Clique na marca para ver a linha do tempo. Começamos com a Coca-Cola —
          em breve adicionaremos outras (Brahma, Smirnoff, Royal Salute…).
        </p>
      </section>

      {/* Componente client: balões + timeline + seções com rolagem */}
      <TimelineClient brands={brands} />
    </main>
  );
}
