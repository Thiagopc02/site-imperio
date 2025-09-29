'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

declare global {
  interface Window {
    grecaptcha?: any;
    __recaptchaV2ScriptLoaded__?: boolean;
  }
}

export type RecaptchaV2Handle = {
  execute: () => void;
  reset: () => void;
  isReady: () => boolean;
};

type Props = {
  onVerify: (token: string) => void;
  /** opcional — se não enviar, usa a env NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY */
  siteKey?: string;
  /** linguagem opcional (ex.: 'pt-BR') */
  hl?: string;
};

const SCRIPT_ID = 'recaptcha-v2-invisible-script';
const WIDGET_RENDERED_FLAG = '__recaptchaV2WidgetRendered__';

const RecaptchaV2Invisible = forwardRef<RecaptchaV2Handle, Props>(
  function RecaptchaV2Invisible({ onVerify, siteKey, hl }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<number | null>(null);
    const executingRef = useRef(false);
    const [ready, setReady] = useState(false);

    const SITE_KEY =
      siteKey?.trim() || process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY;

    // Renderiza o widget (chamado quando o script estiver pronto)
    const renderWidget = useCallback(() => {
      if (!SITE_KEY || !window.grecaptcha || !containerRef.current) return;
      if (widgetIdRef.current !== null) return; // já renderizado

      // evita renderizar mais de uma vez em HMR
      if ((containerRef.current as any)[WIDGET_RENDERED_FLAG]) return;

      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: 'invisible',
        callback: (token: string) => {
          executingRef.current = false; // liberado para próxima execução
          onVerify(token);
        },
      });

      (containerRef.current as any)[WIDGET_RENDERED_FLAG] = true;
      setReady(true);
    }, [SITE_KEY, onVerify]);

    // Carrega o script uma única vez e renderiza quando carregar
    useEffect(() => {
      if (!SITE_KEY) {
        console.error(
          '[reCAPTCHA v2] NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ausente.'
        );
        return;
      }

      // já carregado anteriormente?
      if (window.__recaptchaV2ScriptLoaded__) {
        // script já no ar, apenas renderiza
        if (window.grecaptcha?.ready) {
          window.grecaptcha.ready(renderWidget);
        } else {
          // fallback
          renderWidget();
        }
        return;
      }

      // já existe tag <script> na página?
      const existing = document.getElementById(SCRIPT_ID) as
        | HTMLScriptElement
        | null;

      const srcBase = 'https://www.google.com/recaptcha/api.js';
      const params = new URLSearchParams({ render: 'explicit' });
      if (hl) params.set('hl', hl);

      const ensureRender = () => {
        window.__recaptchaV2ScriptLoaded__ = true;
        if (window.grecaptcha?.ready) {
          window.grecaptcha.ready(renderWidget);
        } else {
          renderWidget();
        }
      };

      if (existing) {
        existing.addEventListener('load', ensureRender, { once: true });
        // se já carregado, chama imediatamente
        if ((existing as any).dataset.loaded === 'true') ensureRender();
        return;
      }

      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.async = true;
      s.defer = true;
      s.src = `${srcBase}?${params.toString()}`;
      s.addEventListener('load', () => {
        (s as any).dataset.loaded = 'true';
        ensureRender();
      });
      document.body.appendChild(s);

      // cleanup: não removemos o script de propósito (compartilhado)
    }, [SITE_KEY, hl, renderWidget]);

    // Métodos expostos
    useImperativeHandle(
      ref,
      (): RecaptchaV2Handle => ({
        isReady: () => ready && widgetIdRef.current !== null,

        execute: () => {
          // evita spam de execuções enquanto uma já está em curso
          if (executingRef.current) return;
          executingRef.current = true;

          if (widgetIdRef.current !== null && window.grecaptcha) {
            try {
              window.grecaptcha.execute(widgetIdRef.current);
            } catch {
              executingRef.current = false;
            }
            return;
          }

          // caso raro: ainda não renderizou — tenta quando estiver pronto
          const start = Date.now();
          const timer = window.setInterval(() => {
            if (
              widgetIdRef.current !== null &&
              window.grecaptcha &&
              Date.now() - start < 8000
            ) {
              window.clearInterval(timer);
              try {
                window.grecaptcha.execute(widgetIdRef.current);
              } catch {
                executingRef.current = false;
              }
            } else if (Date.now() - start >= 8000) {
              window.clearInterval(timer);
              executingRef.current = false;
            }
          }, 150);
        },

        reset: () => {
          executingRef.current = false;
          if (window.grecaptcha && widgetIdRef.current !== null) {
            try {
              window.grecaptcha.reset(widgetIdRef.current);
            } catch {
              /* ignore */
            }
          }
        },
      }),
      [ready]
    );

    // host invisível (não ocupa layout)
    return (
      <div
        ref={containerRef}
        className="g-recaptcha"
        style={{ display: 'none' }}
        aria-hidden
      />
    );
  }
);

export default RecaptchaV2Invisible;
