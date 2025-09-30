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

const RecaptchaV2Invisible = forwardRef<RecaptchaV2Handle, Props>(function RecaptchaV2Invisible(
  { onVerify, siteKey, hl },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const executingRef = useRef(false);
  const [ready, setReady] = useState(false);

  const SITE_KEY = (siteKey?.trim() ||
    process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ||
    '') as string;

  // Renderiza o widget quando o script estiver pronto
  const renderWidget = useCallback(() => {
    if (!SITE_KEY || !window.grecaptcha || !containerRef.current) return;
    if (widgetIdRef.current !== null) return; // já renderizado
    if ((containerRef.current as any)[WIDGET_RENDERED_FLAG]) return; // evita re-render

    widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
      sitekey: SITE_KEY,
      size: 'invisible',
      callback: (token: string) => {
        executingRef.current = false;
        // debug útil
        if (process.env.NODE_ENV !== 'production') {
          console.log('[recaptcha] token len:', token?.length);
        }
        onVerify(token);
      },
      'error-callback': () => {
        executingRef.current = false;
        console.warn('[recaptcha] error-callback');
      },
      'expired-callback': () => {
        executingRef.current = false;
        console.warn('[recaptcha] expired-callback');
      },
    });

    (containerRef.current as any)[WIDGET_RENDERED_FLAG] = true;
    setReady(true);
  }, [SITE_KEY, onVerify]);

  // Carrega o script uma única vez e renderiza quando carregar
  useEffect(() => {
    if (!SITE_KEY) {
      console.error('[reCAPTCHA v2] NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ausente.');
      return;
    }

    // se o script já foi carregado antes
    if (window.__recaptchaV2ScriptLoaded__) {
      if (window.grecaptcha?.ready) window.grecaptcha.ready(renderWidget);
      else renderWidget();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const srcBase = 'https://www.google.com/recaptcha/api.js';
    const params = new URLSearchParams({ render: 'explicit' });
    if (hl) params.set('hl', hl);

    const ensureRender = () => {
      window.__recaptchaV2ScriptLoaded__ = true;
      if (window.grecaptcha?.ready) window.grecaptcha.ready(renderWidget);
      else renderWidget();
    };

    if (existing) {
      existing.addEventListener('load', ensureRender, { once: true });
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
  }, [SITE_KEY, hl, renderWidget]);

  // Métodos expostos
  useImperativeHandle(
    ref,
    (): RecaptchaV2Handle => ({
      isReady: () => ready && widgetIdRef.current !== null,

      execute: () => {
        if (executingRef.current) return; // evita spam
        executingRef.current = true;

        if (widgetIdRef.current !== null && window.grecaptcha) {
          try {
            window.grecaptcha.execute(widgetIdRef.current);
          } catch {
            executingRef.current = false;
          }
          return;
        }

        // ainda não renderizou — tentar por alguns segundos
        const start = Date.now();
        const timer = window.setInterval(() => {
          const ok =
            widgetIdRef.current !== null &&
            !!window.grecaptcha &&
            Date.now() - start < 8000;

          if (ok) {
            window.clearInterval(timer);
            try {
              window.grecaptcha.execute(widgetIdRef.current!);
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

  // Container do widget — **sem display:none** para o v2 Invisible funcionar bem
  return <div ref={containerRef} className="g-recaptcha" aria-hidden />;
});

export default RecaptchaV2Invisible;
