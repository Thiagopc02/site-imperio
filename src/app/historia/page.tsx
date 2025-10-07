// src/app/historia/page.tsx
import TimelineClient from "./timeline-client";

export const metadata = {
  title: "História das Marcas | Império",
  description:
    "Linha do tempo interativa das grandes marcas. Começando pela Coca-Cola, com marcos, imagens e curiosidades até os dias atuais.",
};

export type TimelineEvent = {
  id: string;
  year: number;
  title: string;
  text: string;
  image?: string; // ex.: /historia/coca/1886.jpg (coloque seus arquivos em /public)
};

export type Brand = {
  slug: string;
  name: string;
  logo: string;     // ícone redondo do topo
  banner?: string;  // opcional
  color: string;    // cor principal (ex.: vermelho Coca)
  dark: string;     // cor escura p/ gradientes
  liquid: string;   // cor do “líquido” no copo
  events: TimelineEvent[];
};

export default function HistoriaPage() {
  // Coca-Cola (exemplo inicial – ajuste livremente)
  const coca: Brand = {
    slug: "coca-cola",
    name: "Coca-Cola",
    logo: "/produtos/coca-cola-2L.jpg",   // garanta que existe em /public
    banner: "/produtos/coca-cola-2L.jpg",
    color: "#E10600",
    dark: "#7a0b0b",
    liquid: "#c81414",
    events: [
      {
        id: "coca-1886",
        year: 1886,
        title: "A fórmula nasce em Atlanta",
        text:
          "John Pemberton cria a Coca-Cola na Jacob’s Pharmacy, vendida em fontes de soda como tônico.",
        image: "/historia/coca/1886.jpg",
      },
      {
        id: "coca-1892",
        year: 1892,
        title: "The Coca-Cola Company",
        text:
          "Asa Griggs Candler adquire direitos e funda a companhia, acelerando a expansão comercial.",
        image: "/historia/coca/1892.jpg",
      },
      {
        id: "coca-1915",
        year: 1915,
        title: "A garrafa contour",
        text:
          "A icônica garrafa de curvas nasce para ser reconhecida até no escuro ou mesmo quebrada.",
        image: "/historia/coca/1915.jpg",
      },
      {
        id: "coca-1931",
        year: 1931,
        title: "O Papai Noel vermelho",
        text:
          "Ilustrações de Haddon Sundblom popularizam o visual moderno do Papai Noel em campanhas.",
        image: "/historia/coca/1931.jpg",
      },
      {
        id: "coca-1941",
        year: 1941,
        title: "Guerra & globalização",
        text:
          "A promessa de vender Coca por 5 cents aos soldados leva fábricas e a marca ao mundo.",
        image: "/historia/coca/1941.jpg",
      },
      {
        id: "coca-1955",
        year: 1955,
        title: "Novos tamanhos & latas",
        text:
          "Mais embalagens e formatos tornam o consumo prático e ampliam a presença da marca.",
        image: "/historia/coca/1955.jpg",
      },
      {
        id: "coca-1961",
        year: 1961,
        title: "Sprite chega ao portfólio",
        text:
          "A família cresce com a Sprite, que se torna um refrigerante de limão global.",
        image: "/historia/coca/1961.jpg",
      },
      {
        id: "coca-1985",
        year: 1985,
        title: "New Coke",
        text:
          "A mudança de fórmula gera reação histórica; a ‘Coca-Cola Classic’ volta pouco depois.",
        image: "/historia/coca/1985.jpg",
      },
      {
        id: "coca-2005",
        year: 2005,
        title: "Coca-Cola Zero",
        text:
          "A linha zero açúcar amplia o alcance para quem busca menos calorias sem abrir mão do sabor.",
        image: "/historia/coca/2005.jpg",
      },
      {
        id: "coca-2016",
        year: 2016,
        title: "Taste the Feeling",
        text:
          "Nova plataforma global foca momentos e sensações compartilhadas ao redor da bebida.",
        image: "/historia/coca/2016.jpg",
      },
      {
        id: "coca-2021",
        year: 2021,
        title: "Sustentabilidade & design",
        text:
          "Rótulos e portfólio simplificados, foco forte em reciclagem e redução de pegada ambiental.",
        image: "/historia/coca/2021.jpg",
      },
      {
        id: "coca-2024",
        year: 2024,
        title: "Inovações e sabores",
        text:
          "Edições limitadas e sabores sazonais; a marca explora experiências e collabs culturais.",
        image: "/historia/coca/2024.jpg",
      },
      {
        id: "coca-2025",
        year: 2025,
        title: "Hoje",
        text:
          "A Coca-Cola segue entre as mais valiosas do planeta, com iniciativas digitais e ESG.",
        image: "/historia/coca/2025.jpg",
      },
    ],
  };

  return (
    <main className="min-h-screen text-white bg-black">
      <section className="container py-10">
        <h1 className="text-3xl font-bold text-center md:text-4xl">
          Histórias de Grandes Marcas
        </h1>
        <p className="max-w-3xl mx-auto mt-2 text-center text-gray-300">
          Clique na marca para ver a linha do tempo. Começamos com a Coca-Cola —
          em breve adicionaremos outras (Brahma, Smirnoff, Royal Salute…).
        </p>
      </section>

      {/* Client: interações, mangueira e copo */}
      <TimelineClient brands={[coca]} />
    </main>
  );
}
