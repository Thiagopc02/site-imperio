import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso | Império Bebidas & Tabacos',
  description:
    'Termos de uso do site Império Bebidas & Tabacos: regras, políticas de compras, responsabilidade, privacidade e outras condições.',
};

export default function TermosDeUsoPage() {
  return (
    <main className="max-w-4xl px-5 py-10 mx-auto text-zinc-200">
      {/* Cabeçalho */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400">Termos de Uso</h1>
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
          <li><a href="#aceitacao" className="hover:underline">1. Aceitação dos Termos</a></li>
          <li><a href="#cadastro" className="hover:underline">2. Cadastro e Conta</a></li>
          <li><a href="#compras" className="hover:underline">3. Compras, Preços e Pagamentos</a></li>
          <li><a href="#entrega" className="hover:underline">4. Entrega e Prazos</a></li>
          <li><a href="#devolucoes" className="hover:underline">5. Trocas, Devoluções e Arrependimento</a></li>
          <li><a href="#idade" className="hover:underline">6. Restrição de Idade (Bebidas/Tabacos)</a></li>
          <li><a href="#conduta" className="hover:underline">7. Conduta do Usuário</a></li>
          <li><a href="#propriedade" className="hover:underline">8. Propriedade Intelectual</a></li>
          <li><a href="#privacidade" className="hover:underline">9. Privacidade e Cookies</a></li>
          <li><a href="#responsabilidade" className="hover:underline">10. Limitação de Responsabilidade</a></li>
          <li><a href="#alteracoes" className="hover:underline">11. Alterações destes Termos</a></li>
          <li><a href="#legislacao" className="hover:underline">12. Legislação e Foro</a></li>
          <li><a href="#contato" className="hover:underline">13. Contato</a></li>
        </ul>
      </nav>

      {/* Conteúdo */}
      <section className="prose prose-invert max-w-none prose-headings:text-white prose-a:text-yellow-300">
        <h2 id="aceitacao" className="mt-10 text-2xl font-semibold scroll-mt-24">
          1. Aceitação dos Termos
        </h2>
        <p>
          Ao acessar e utilizar o site <strong>Império Bebidas & Tabacos</strong> (doravante “Plataforma”), você declara que leu,
          compreendeu e concorda com estes Termos de Uso e com as demais políticas referenciadas. Caso não concorde, não utilize a Plataforma.
        </p>

        <h2 id="cadastro" className="mt-10 text-2xl font-semibold scroll-mt-24">
          2. Cadastro e Conta
        </h2>
        <ul>
          <li>Você é responsável pelas informações fornecidas no cadastro.</li>
          <li>Mantenha seu e-mail e senha em sigilo. Ações na conta são atribuídas ao titular.</li>
          <li>Contas podem ser suspensas em caso de violação destes Termos.</li>
        </ul>

        <h2 id="compras" className="mt-10 text-2xl font-semibold scroll-mt-24">
          3. Compras, Preços e Pagamentos
        </h2>
        <ul>
          <li>Preços e condições podem mudar sem aviso, respeitando pedidos já concluídos.</li>
          <li>Pedidos dependem da aprovação do pagamento.</li>
          <li>Cupons e promoções possuem regras específicas.</li>
          <li>Erros evidentes de preço/estoque podem levar ao cancelamento com estorno.</li>
        </ul>

        <h2 id="entrega" className="mt-10 text-2xl font-semibold scroll-mt-24">
          4. Entrega e Prazos
        </h2>
        <ul>
          <li>Prazos variam por endereço, transportadora e disponibilidade.</li>
          <li>Alguém maior de idade deve estar disponível para receber.</li>
        </ul>

        <h2 id="devolucoes" className="mt-10 text-2xl font-semibold scroll-mt-24">
          5. Trocas, Devoluções e Direito de Arrependimento
        </h2>
        <p>
          Devolução por arrependimento segue o prazo legal (produto lacrado e não utilizado). Em caso de avaria ou vício, contate nossos canais oficiais.
        </p>

        <h2 id="idade" className="mt-10 text-2xl font-semibold scroll-mt-24">
          6. Restrição de Idade (Bebidas/Tabacos)
        </h2>
        <p>
          A venda de bebidas alcoólicas e produtos de tabaco é proibida para menores de 18 anos. Ao comprar, você declara ser maior de idade.
        </p>

        <h2 id="conduta" className="mt-10 text-2xl font-semibold scroll-mt-24">
          7. Conduta do Usuário
        </h2>
        <ul>
          <li>Não publique conteúdo ilegal/ofensivo.</li>
          <li>É vedado scraping, engenharia reversa e ataques à Plataforma.</li>
          <li>Uso comercial de conteúdo sem autorização é proibido.</li>
        </ul>

        <h2 id="propriedade" className="mt-10 text-2xl font-semibold scroll-mt-24">
          8. Propriedade Intelectual
        </h2>
        <p>
          Marcas, imagens, textos e demais materiais são protegidos por leis de propriedade intelectual. O uso indevido é vedado.
        </p>

        <h2 id="privacidade" className="mt-10 text-2xl font-semibold scroll-mt-24">
          9. Privacidade e Cookies
        </h2>
        <p>
          Tratamos dados pessoais conforme nossa{' '}
          <Link href="/privacidade" className="underline">Política de Privacidade</Link>. O uso do site implica concordância com cookies conforme essa política.
        </p>

        <h2 id="responsabilidade" className="mt-10 text-2xl font-semibold scroll-mt-24">
          10. Limitação de Responsabilidade
        </h2>
        <p>
          A Plataforma é fornecida “como está”. Na máxima medida permitida pela lei, não nos responsabilizamos por danos indiretos, incidentais, lucros cessantes ou perda de dados.
        </p>

        <h2 id="alteracoes" className="mt-10 text-2xl font-semibold scroll-mt-24">
          11. Alterações destes Termos
        </h2>
        <p>
          Podemos atualizar estes Termos periodicamente. O uso continuado após a divulgação das alterações implica concordância com a nova versão.
        </p>

        <h2 id="legislacao" className="mt-10 text-2xl font-semibold scroll-mt-24">
          12. Legislação Aplicável e Foro
        </h2>
        <p>
          Regidos pelas leis brasileiras. Foro eleito: <strong>Campos Belos/GO</strong>.
        </p>

        <h2 id="contato" className="mt-10 text-2xl font-semibold scroll-mt-24">
          13. Contato
        </h2>
        <p>Em caso de dúvidas, fale com a gente pelos canais oficiais:</p>
        <ul>
          <li>
            <Link href="/contato" className="underline">Fale conosco</Link>
          </li>
          <li>
            <Link href="/ajuda" className="underline">Central de ajuda</Link>
          </li>
          <li>
            Instagram:{' '}
            <a
              className="underline"
              href="https://instagram.com/distribuidoraimperio3015"
              target="_blank"
              rel="noopener noreferrer"
            >
              @distribuidoraimperio3015
            </a>
          </li>
          <li>
            WhatsApp:{' '}
            <a
              className="underline"
              href="https://wa.me/5562996916206"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir conversa no WhatsApp com Império Bebidas & Tabacos"
            >
              (62) 99691-6206
            </a>
          </li>
        </ul>

        <div className="p-4 mt-12 text-sm border rounded-xl border-zinc-800 bg-zinc-950/60 text-zinc-400">
          <p className="font-medium text-zinc-300">Identificação da empresa</p>
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
          href="/privacidade"
          className="px-4 py-2 border rounded-lg border-zinc-700 text-zinc-200 hover:bg-zinc-800"
        >
          Política de Privacidade
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
