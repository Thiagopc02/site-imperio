// src/components/Footer.tsx
'use client';

export default function Footer() {
  return (
    <footer className="mt-12 text-white border-t border-white/10 bg-neutral-900">
      <div className="grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 mx-auto sm:grid-cols-2 lg:grid-cols-4">
        {/* Marca + descrição */}
        <div>
          <div className="flex items-center gap-3">
            {/* Altere o src se o arquivo do logo tiver outro nome/caminho */}
            <img
              src="/logo-imperio-ilimitada.png"
              alt="Império Bebidas & Tabacos"
              className="w-auto h-9"
            />
            <span className="text-lg font-semibold tracking-wide">
              Império Bebidas & Tabacos
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-300/80">
            Distribuidora oficial em Campos Belos-GO. Qualidade e exclusividade
            direto para sua casa.
          </p>

          {/* Social */}
          <div className="flex items-center gap-3 mt-5">
            {/* Instagram oficial */}
            <a
              href="https://instagram.com/distribuidoraimperio3015"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @distribuidoraimperio3015"
              className="inline-flex items-center justify-center w-10 h-10 transition-transform rounded-full group bg-gradient-to-tr from-purple-500 via-pink-500 to-yellow-500 hover:scale-110"
              title="@distribuidoraimperio3015 no Instagram"
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 2C4.2 2 2 4.2 2 7v10c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5V7c0-2.8-2.2-5-5-5H7zm0 2h10c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3zm11 1.8a1.2 1.2 0 10.001 2.401A1.2 1.2 0 0018 5.8zM12 7.5A4.5 4.5 0 1012 16.5 4.5 4.5 0 0012 7.5zm0 2a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"/>
              </svg>
            </a>

            {/* “Facebook” estilizado → também aponta para o Instagram */}
            <a
              href="https://instagram.com/distribuidoraimperio3015"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Perfil oficial"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] transition-transform hover:scale-110"
              title="Perfil oficial"
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 22v-8h2.7l.4-3h-3.1V8.6c0-.9.3-1.6 1.6-1.6H17V4.2c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V11H9v3h2.1v8h2.4z"/>
              </svg>
            </a>

            {/* “Twitter/X” estilizado → também aponta para o Instagram */}
            <a
              href="https://instagram.com/distribuidoraimperio3015"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Perfil oficial"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1DA1F2] transition-transform hover:scale-110"
              title="Perfil oficial"
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 5.8c-.7.3-1.5.6-2.3.7.8-.5 1.4-1.3 1.7-2.2-.7.4-1.6.8-2.5 1A3.9 3.9 0 0012 8.7c0 .3 0 .6.1.9-3.2-.2-6.1-1.7-8-4.1-.4.7-.6 1.3-.6 2.1 0 1.4.7 2.6 1.8 3.3-.6 0-1.2-.2-1.7-.5v.1c0 2 1.4 3.6 3.3 4-.3.1-.7.1-1 .1-.2 0-.5 0-.7-.1.5 1.6 2 2.8 3.8 2.9A7.9 7.9 0 012 19.6 11 11 0 008 21.3c7.2 0 11.1-6 11.1-11.1v-.5c.7-.5 1.3-1.2 1.8-1.9z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Institucional */}
        <div>
          <h4 className="text-base font-semibold text-white/90">Institucional</h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-300/90">
            <li><a href="/sobre-nos" className="hover:text-white/100 hover:underline">Sobre nós</a></li>
            <li><a href="/termos" className="hover:text-white/100 hover:underline">Termos de uso</a></li>
            <li><a href="/privacidade" className="hover:text-white/100 hover:underline">Privacidade</a></li>
          </ul>
        </div>

        {/* Atendimento */}
        <div>
          <h4 className="text-base font-semibold text-white/90">Atendimento</h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-300/90">
            <li><a href="/contato" className="hover:text-white/100 hover:underline">Fale conosco</a></li>
            <li><a href="/ajuda" className="hover:text-white/100 hover:underline">Central de ajuda</a></li>
          </ul>
        </div>

        {/* Info rápida */}
        <div>
          <h4 className="text-base font-semibold text-white/90">Informações</h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-300/90">
            <li>Campos Belos-GO</li>
            <li>Seg–Sáb: 08h–20h</li>
            <li>
              Instagram:{' '}
              <a
                href="https://instagram.com/distribuidoraimperio3015"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-white hover:underline"
              >
                @distribuidoraimperio3015
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="max-w-6xl px-4 py-4 mx-auto text-xs text-center text-gray-400">
          © {new Date().getFullYear()} Império Bebidas & Tabacos. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
