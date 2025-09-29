import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fale Conosco | Império Bebidas & Tabacos",
  description:
    "Entre em contato com a Império Bebidas & Tabacos. Atendimento rápido pelo WhatsApp e canais oficiais.",
};

const WHATS_LINK = "https://wa.me/5562996916206";

export default function ContatoPage() {
  return (
    <main className="max-w-4xl px-5 py-10 mx-auto text-zinc-200">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400">Fale Conosco</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Estamos prontos para te atender. Escolha o canal preferido abaixo.
        </p>
      </header>

      {/* Cartão WhatsApp */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="p-5 border rounded-2xl border-emerald-500/30 bg-emerald-500/5">
          <h2 className="text-xl font-semibold text-emerald-300">WhatsApp</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Atendimento rápido, pedidos e dúvidas gerais.
          </p>

          <a
            href={WHATS_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 mt-4 font-semibold text-black transition rounded-xl bg-emerald-500 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            aria-label="Abrir conversa no WhatsApp com a Império"
            title="Chamar no WhatsApp"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20.52 3.48A11.91 11.91 0 0 0 12.06 0C5.52 0 .24 5.28.24 11.82c0 2.08.54 4.08 1.57 5.88L0 24l6.45-1.74c1.7.93 3.63 1.43 5.6 1.43h.01c6.54 0 11.82-5.28 11.82-11.82 0-3.16-1.23-6.12-3.36-8.39ZM12.06 21.6h-.01c-1.74 0-3.45-.47-4.94-1.35l-.35-.21-3.82 1.03 1.02-3.72-.23-.38A9.74 9.74 0 0 1 2.4 11.82c0-5.33 4.33-9.66 9.66-9.66 2.58 0 5 .99 6.83 2.8a9.58 9.58 0 0 1 2.83 6.86c0 5.33-4.33 9.66-9.66 9.66Zm5.5-7.24c-.3-.15-1.77-.87-2.05-.96-.27-.1-.47-.15-.67.14-.2.3-.77.97-.95 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.73-1.64-2.02-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.44 0 1.44 1.06 2.84 1.21 3.04.15.2 2.09 3.2 5.07 4.48.71.3 1.26.48 1.69.62.71.23 1.35.2 1.86.12.57-.08 1.77-.72 2.02-1.41.25-.7.25-1.3.17-1.41-.07-.11-.26-.18-.57-.34Z" />
            </svg>
            Conversar no WhatsApp (62) 99691-6206
          </a>

          <p className="mt-3 text-xs text-zinc-400">
            Dica: salve o número nos contatos para encontrar a gente mais rápido.
          </p>
        </div>

        {/* Outros canais opcionais */}
        <div className="p-5 border rounded-2xl border-zinc-700 bg-zinc-900">
          <h2 className="text-xl font-semibold">Outros canais</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              Instagram:{" "}
              <a
                href="https://instagram.com/distribuidoraimperio3015"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-300 underline"
              >
                @distribuidoraimperio3015
              </a>
            </li>
            <li>
              Central de ajuda:{" "}
              <Link href="/ajuda" className="text-yellow-300 underline">
                /ajuda
              </Link>
            </li>
            <li>
              Sobre nós:{" "}
              <Link href="/sobre-nos" className="text-yellow-300 underline">
                /sobre-nos
              </Link>
            </li>
            <li>
              Política de privacidade:{" "}
              <Link href="/privacidade" className="text-yellow-300 underline">
                /privacidade
              </Link>
            </li>
            <li>
              Termos de uso:{" "}
              <Link href="/termos" className="text-yellow-300 underline">
                /termos
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA voltar / segurança */}
      <div className="flex flex-wrap gap-3 mt-10">
        <Link
          href="/"
          className="px-4 py-2 font-semibold text-black bg-yellow-400 rounded-lg hover:bg-yellow-300"
        >
          Voltar à página inicial
        </Link>
        <a
          href={WHATS_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border rounded-lg border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        >
          Abrir WhatsApp agora
        </a>
      </div>
    </main>
  );
}
