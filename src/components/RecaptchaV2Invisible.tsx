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
    grecaptcha?: {
      render: (container: HTMLElement | string, params: any) => number;
      execute: (id?: number) => void;
      reset: (id?: number) => void;
      ready?: (cb: () => void) => void;
    };
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
  siteKey?: string;              // se não vier, usa NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY
  hl?: string;                   // idioma (ex.: 'pt-BR')
  badge?: 'bottomright' | 'bottomleft' | 'inline';
};

const SCRIPT_ID = 'recaptcha-v2-invisible-script';
const WIDGET_RENDERED_FLAG = '__recaptchaV2WidgetRendered__';

/** Guard que devolve o grecaptcha tipado (ou undefined no SSR/sem script) */
function getGrecaptcha() {
  if (typeof window === 'undefined') return undefined;
  return window.grecaptcha;
}

const RecaptchaV2Invisible = forwardRef<RecaptchaV2Handle, Props>(
  ({ onVerify, siteKey, hl, badge = 'bottomright' }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<number | null>(null);
    const executingRef = useRef(false);
    const [ready, setReady] = useState(false);

    const SITE_KEY =
      (siteKey?.trim() ||
        process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ||
        '') as string;

    // Renderiza o widget quando o script estiver pronto
    const renderWidget = useCallback(() => {
      const g = getGrecaptcha();
      if (!SITE_KEY || !g || !containerRef.current) return;
      if (widgetIdRef.current !== null) return; // já renderizado
      if ((containerRef.current as any)[WIDGET_RENDERED_FLAG]) return; // evita re-render

      widgetIdRef.current = g.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: 'invisible',
        badge,
        callback: (token: string) => {
          executingRef.current = false;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[recaptcha] token obtido');
          }
          onVerify(token);
        },
        'error-callback': () => {
          executingRef.current = false;
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[recaptcha] error-callback');
          }
        },
        'expired-callback': () => {
          executingRef.current = false;
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[recaptcha] expired-callback');
          }
        },
      });

      (containerRef.current as any)[WIDGET_RENDERED_FLAG] = true;
      setReady(true);
    }, [SITE_KEY, onVerify, badge]);

    // Carrega o script uma única vez e renderiza quando carregar
    useEffect(() => {
      if (!SITE_KEY) {
        console.error('[reCAPTCHA v2] NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ausente.');
        return;
      }

      const ensureRender = () => {
        window.__recaptchaV2ScriptLoaded__ = true;
        const g = getGrecaptcha();
        if (g?.ready) g.ready(renderWidget);
        else renderWidget();
      };

      // já carregado anteriormente
      if (window.__recaptchaV2ScriptLoaded__) {
        ensureRender();
        return;
      }

      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (existing) {
        const onLoad = () => ensureRender();
        existing.addEventListener('load', onLoad, { once: true });
        if ((existing as any).dataset.loaded === 'true') ensureRender();

        return () => existing.removeEventListener('load', onLoad);
      }

      // injeta o script
      const srcBase = 'https://www.google.com/recaptcha/api.js';
      const params = new URLSearchParams({ render: 'explicit' });
      if (hl) params.set('hl', hl);

      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.async = true;
      s.defer = true;
      s.src = `${srcBase}?${params.toString()}`;

      const onLoad = () => {
        (s as any).dataset.loaded = 'true';
        ensureRender();
      };

      s.addEventListener('load', onLoad);
      document.body.appendChild(s);

      return () => {
        s.removeEventListener('load', onLoad);
        // não removemos o script para permitir reuso global
      };
    }, [SITE_KEY, hl, renderWidget]);

    // Métodos expostos
    useImperativeHandle(
      ref,
      (): RecaptchaV2Handle => ({
        isReady: () => ready && widgetIdRef.current !== null,

        execute: () => {
          if (executingRef.current) return; // evita spam
          executingRef.current = true;

          const g = getGrecaptcha();

          if (widgetIdRef.current !== null && g) {
            try {
              g.execute(widgetIdRef.current);
            } catch {
              executingRef.current = false;
            }
            return;
          }

          // ainda não renderizou — tenta por alguns segundos
          const start = Date.now();
          const timer = window.setInterval(() => {
            const g2 = getGrecaptcha();
            const widgetOk = widgetIdRef.current !== null && !!g2;
            const withinTime = Date.now() - start < 8000;

            if (widgetOk && g2) {
              window.clearInterval(timer);
              try {
                g2.execute(widgetIdRef.current!);
              } catch {
                executingRef.current = false;
              }
            } else if (!withinTime) {
              window.clearInterval(timer);
              executingRef.current = false;
            }
          }, 150);
        },

        reset: () => {
          executingRef.current = false;
          const g = getGrecaptcha();
          if (g && widgetIdRef.current !== null) {
            try {
              g.reset(widgetIdRef.current);
            } catch {
              /* ignore */
            }
          }
        },
      }),
      [ready]
    );

    // Container do widget — **sem display:none** para o v2 Invisible funcionar
    return <div ref={containerRef} className="g-recaptcha" aria-hidden />;
  }
);

RecaptchaV2Invisible.displayName = 'RecaptchaV2Invisible';
export default RecaptchaV2Invisible;
