import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | Império Bebidas & Tabacos",
  description:
    "Saiba como a Império Bebidas & Tabacos coleta, usa, compartilha e protege seus dados pessoais, conforme a LGPD.",
};

export default function PoliticaPrivacidadePage() {
  return (
    <main className="max-w-4xl px-5 py-10 mx-auto text-zinc-200">
      {/* Cabeçalho */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Última atualização: <strong>24/09/2025</strong>
        </p>
      </header>

      {/* Sumário */}
      <nav
        aria-label="Sumário"
        className="p-4 mb-8 border rounded-xl border-zinc-800 bg-zinc-950/60"
      >
        <p className="mb-2 text-sm font-semibold text-zinc-300">Neste documento:</p>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li><a href="#coleta" className="hover:underline">1. Quais dados coletamos</a></li>
          <li><a href="#uso" className="hover:underline">2. Como usamos seus dados</a></li>
          <li><a href="#bases" className="hover:underline">3. Bases legais (LGPD)</a></li>
          <li><a href="#cookies" className="hover:underline">4. Cookies e tecnologias</a></li>
          <li><a href="#compartilhamento" className="hover:underline">5. Compartilhamento</a></li>
          <li><a href="#armazenamento" className="hover:underline">6. Armazenamento e segurança</a></li>
          <li><a href="#direitos" className="hover:underline">7. Direitos do titular</a></li>
          <li><a href="#retencao" className="hover:underline">8. Retenção de dados</a></li>
          <li><a href="#menores" className="hover:underline">9. Dados de menores</a></li>
          <li><a href="#alteracoes" className="hover:underline">10. Alterações desta política</a></li>
          <li><a href="#contato" className="hover:underline">11. Como falar com a gente</a></li>
        </ul>
      </nav>

      {/* Conteúdo */}
      <section className="prose prose-invert max-w-none prose-headings:text-white prose-a:text-yellow-300">
        <p>
          Na <strong>Império Bebidas & Tabacos</strong> levamos sua privacidade a sério.
          Este documento explica, de forma clara e objetiva, como tratamos seus dados pessoais
          conforme a <strong>Lei nº 13.709/2018 (LGPD)</strong>.
        </p>

        <h2 id="coleta" className="mt-10 text-2xl font-semibold scroll-mt-24">
          1. Quais dados coletamos
        </h2>
        <ul>
          <li><strong>Cadastro:</strong> nome, e-mail, senha, telefone, CPF/CNPJ, CEP, cidade/UF.</li>
          <li><strong>Uso do site:</strong> páginas acessadas, buscas, carrinho, IP, data/hora, identificadores de dispositivo.</li>
          <li><strong>Transações:</strong> itens comprados, valores, formas de pagamento (intermediadas por parceiros).</li>
          <li><strong>Atendimento:</strong> mensagens enviadas por “Fale conosco”, suporte e redes sociais.</li>
        </ul>

        <h2 id="uso" className="mt-10 text-2xl font-semibold scroll-mt-24">
          2. Como usamos seus dados
        </h2>
        <ul>
          <li>Prestar os serviços do site (cadastro, compras, entrega e atendimento).</li>
          <li>Prevenir fraudes e garantir segurança da plataforma.</li>
          <li>Comunicar status de pedidos e suporte.</li>
          <li>Personalizar a experiência e recomendar produtos.</li>
          <li>Atender obrigações legais e regulatórias aplicáveis.</li>
        </ul>

        <h2 id="bases" className="mt-10 text-2xl font-semibold scroll-mt-24">
          3. Bases legais (LGPD)
        </h2>
        <p>Tratamos dados principalmente com base em:</p>
        <ul>
          <li><strong>Execução de contrato</strong> (art. 7º, V): para viabilizar sua compra/conta.</li>
          <li><strong>Cumprimento de obrigação legal/regulatória</strong> (art. 7º, II).</li>
          <li><strong>Legítimo interesse</strong> (art. 7º, IX), com avaliação de impacto e expectativa do usuário.</li>
          <li><strong>Consentimento</strong> (art. 7º, I), quando aplicável (ex.: comunicações de marketing).</li>
        </ul>

        <h2 id="cookies" className="mt-10 text-2xl font-semibold scroll-mt-24">
          4. Cookies e tecnologias similares
        </h2>
        <p>
          Utilizamos cookies para manter sua sessão, lembrar preferências, entender o uso do site e
          melhorar serviços. Você pode gerenciá-los no navegador; ao desativar, alguns recursos podem
          ficar indisponíveis.
        </p>

        <h2 id="compartilhamento" className="mt-10 text-2xl font-semibold scroll-mt-24">
          5. Compartilhamento com terceiros
        </h2>
        <p>
          Compartilhamos dados estritamente necessários com provedores de tecnologia (ex.: hospedagem,
          processamento de pagamentos, antifraude, logística) e autoridades quando requerido por lei.
          Não vendemos dados pessoais.
        </p>

        <h2 id="armazenamento" className="mt-10 text-2xl font-semibold scroll-mt-24">
          6. Armazenamento e segurança
        </h2>
        <p>
          Adotamos medidas técnicas e administrativas razoáveis para proteger seus dados contra
          acesso não autorizado, perda, uso indevido ou alteração. Ainda assim, nenhum sistema é 100% seguro.
        </p>

        <h2 id="direitos" className="mt-10 text-2xl font-semibold scroll-mt-24">
          7. Seus direitos como titular
        </h2>
        <p>Nos termos da LGPD, você pode solicitar:</p>
        <ul>
          <li>Confirmação da existência de tratamento e acesso aos dados.</li>
          <li>Correção, anonimização, bloqueio ou eliminação de dados desnecessários.</li>
          <li>Portabilidade e informações sobre compartilhamentos.</li>
          <li>Revogação do consentimento, quando aplicável.</li>
        </ul>
        <p>
          Para exercer seus direitos, utilize os canais em{" "}
          <a href="#contato" className="underline">Como falar com a gente</a>.
        </p>

        <h2 id="retencao" className="mt-10 text-2xl font-semibold scroll-mt-24">
          8. Retenção de dados
        </h2>
        <p>
          Mantemos seus dados pelo tempo necessário às finalidades descritas e pelo prazo exigido
          por lei (ex.: obrigações fiscais/contábeis). Depois disso, eliminamos ou anonimizamos.
        </p>

        <h2 id="menores" className="mt-10 text-2xl font-semibold scroll-mt-24">
          9. Dados de menores
        </h2>
        <p>
          Nossos produtos (bebidas alcoólicas/tabacos) são destinados exclusivamente a maiores de 18 anos.
          Não coletamos intencionalmente dados de menores.
        </p>

        <h2 id="alteracoes" className="mt-10 text-2xl font-semibold scroll-mt-24">
          10. Alterações desta política
        </h2>
        <p>
          Esta política pode ser atualizada a qualquer momento. Publicaremos a nova versão nesta página
          com a data de revisão indicada no topo.
        </p>

        <h2 id="contato" className="mt-10 text-2xl font-semibold scroll-mt-24">
          11. Como falar com a gente
        </h2>
        <ul>
          <li>
            <Link href="/contato" className="underline">Fale conosco</Link>
          </li>
          <li>
            <Link href="/ajuda" className="underline">Central de ajuda</Link>
          </li>
          <li>
            Instagram:{" "}
            <a
              href="https://instagram.com/distribuidoraimperio3015"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              @distribuidoraimperio3015
            </a>
          </li>
          <li>
            WhatsApp:{" "}
            <a
              href="https://wa.me/5562996916206"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              aria-label="Abrir conversa no WhatsApp com Império Bebidas & Tabacos"
            >
              (62) 99691-6206
            </a>
          </li>
        </ul>

        <div className="p-4 mt-12 text-sm border rounded-xl border-zinc-800 bg-zinc-950/60 text-zinc-400">
          <p className="font-medium text-zinc-300">Controlador de dados</p>
          <p>
            Império Bebidas & Tabacos — Campos Belos/GO
            {/* Insira CNPJ/IE e endereço completo se desejar */}
          </p>
        </div>
      </section>

      {/* CTAs finais */}
      <div className="flex flex-wrap gap-3 mt-12">
        <Link
          href="/"
          className="px-4 py-2 font-semibold text-black bg-yellow-400 rounded-lg hover:bg-yellow-300"
        >
          Voltar à página inicial
        </Link>

        <Link
          href="/termos"
          className="px-4 py-2 border rounded-lg border-zinc-700 text-zinc-200 hover:bg-zinc-800"
        >
          Termos de Uso
        </Link>

        <a
          href="https://wa.me/5562996916206"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border rounded-lg border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        >
          Falar no WhatsApp
        </a>
      </div>
    </main>
  );
}
