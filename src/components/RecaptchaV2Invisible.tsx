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
      /** existe no v2 e retorna o token (ou string vazia) */
      getResponse?: (id?: number) => string;
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
  siteKey?: string;
  hl?: string;
  badge?: 'bottomright' | 'bottomleft' | 'inline';
};

const SCRIPT_ID = 'recaptcha-v2-invisible-script';
const WIDGET_RENDERED_FLAG = '__recaptchaV2WidgetRendered__';

function getG() {
  if (typeof window === 'undefined') return undefined;
  return window.grecaptcha;
}

const RecaptchaV2Invisible = forwardRef<RecaptchaV2Handle, Props>(
  ({ onVerify, siteKey, hl, badge = 'bottomright' }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<number | null>(null);
    const executingRef = useRef(false);
    const tokenWatcherRef = useRef<number | null>(null); // interval id
    const [ready, setReady] = useState(false);

    const SITE_KEY =
      (siteKey?.trim() ||
        process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ||
        '') as string;

    const finishWithToken = (token: string) => {
      // evita chamada dupla (callback + watcher)
      if (!executingRef.current) return;
      executingRef.current = false;

      if (tokenWatcherRef.current !== null) {
        window.clearInterval(tokenWatcherRef.current);
        tokenWatcherRef.current = null;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.info('[recaptcha] token obtido (len=', token.length, ')');
      }
      onVerify(token);
    };

    const renderWidget = useCallback(() => {
      const g = getG();
      if (!SITE_KEY || !g || !containerRef.current) return;
      if (widgetIdRef.current !== null) return;
      if ((containerRef.current as any)[WIDGET_RENDERED_FLAG]) return;

      widgetIdRef.current = g.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: 'invisible',
        badge,
        callback: (token: string) => finishWithToken(token),
        'error-callback': () => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[recaptcha] error-callback');
          }
          executingRef.current = false;
          if (tokenWatcherRef.current !== null) {
            window.clearInterval(tokenWatcherRef.current);
            tokenWatcherRef.current = null;
          }
        },
        'expired-callback': () => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[recaptcha] expired-callback');
          }
          executingRef.current = false;
          if (tokenWatcherRef.current !== null) {
            window.clearInterval(tokenWatcherRef.current);
            tokenWatcherRef.current = null;
          }
        },
      });

      (containerRef.current as any)[WIDGET_RENDERED_FLAG] = true;
      setReady(true);
    }, [SITE_KEY, badge]);

    useEffect(() => {
      if (!SITE_KEY) {
        console.error('[reCAPTCHA v2] NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ausente.');
        return;
      }

      const ensureRender = () => {
        window.__recaptchaV2ScriptLoaded__ = true;
        const g = getG();
        if (g?.ready) g.ready(renderWidget);
        else renderWidget();
      };

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
      };
    }, [SITE_KEY, hl, renderWidget]);

    useImperativeHandle(
      ref,
      (): RecaptchaV2Handle => ({
        isReady: () => ready && widgetIdRef.current !== null,

        execute: () => {
          if (executingRef.current) return;
          executingRef.current = true;

          const g = getG();
          const id = widgetIdRef.current;

          if (id !== null && g) {
            try {
              g.execute(id);
            } catch {
              executingRef.current = false;
              return;
            }

            // *** FALLBACK: vigia o token pelo getResponse por até 10s ***
            if (g.getResponse && tokenWatcherRef.current === null) {
              const start = Date.now();
              tokenWatcherRef.current = window.setInterval(() => {
                try {
                  const token = g.getResponse!(id);
                  if (token) {
                    finishWithToken(token);
                  } else if (Date.now() - start > 10000) {
                    // tempo esgotado
                    executingRef.current = false;
                    window.clearInterval(tokenWatcherRef.current!);
                    tokenWatcherRef.current = null;
                  }
                } catch {
                  // se der erro, encerra o watcher
                  executingRef.current = false;
                  window.clearInterval(tokenWatcherRef.current!);
                  tokenWatcherRef.current = null;
                }
              }, 150);
            }
            return;
          }

          // se ainda não renderizou, aguarda alguns segundos
          const start = Date.now();
          const timer = window.setInterval(() => {
            const g2 = getG();
            const ok = widgetIdRef.current !== null && !!g2;
            const within = Date.now() - start < 8000;

            if (ok && g2) {
              window.clearInterval(timer);
              try {
                g2.execute(widgetIdRef.current!);
              } catch {
                executingRef.current = false;
                return;
              }
              // inicia watcher também nesse caminho
              if (g2.getResponse && tokenWatcherRef.current === null) {
                const t0 = Date.now();
                tokenWatcherRef.current = window.setInterval(() => {
                  try {
                    const token = g2.getResponse!(widgetIdRef.current!);
                    if (token) {
                      finishWithToken(token);
                    } else if (Date.now() - t0 > 10000) {
                      executingRef.current = false;
                      window.clearInterval(tokenWatcherRef.current!);
                      tokenWatcherRef.current = null;
                    }
                  } catch {
                    executingRef.current = false;
                    window.clearInterval(tokenWatcherRef.current!);
                    tokenWatcherRef.current = null;
                  }
                }, 150);
              }
            } else if (!within) {
              window.clearInterval(timer);
              executingRef.current = false;
            }
          }, 150);
        },

        reset: () => {
          executingRef.current = false;
          if (tokenWatcherRef.current !== null) {
            window.clearInterval(tokenWatcherRef.current);
            tokenWatcherRef.current = null;
          }
          const g = getG();
          if (g && widgetIdRef.current !== null) {
            try {
              g.reset(widgetIdRef.current);
            } catch { /* ignore */ }
          }
        },
      }),
      [ready]
    );

    return <div ref={containerRef} className="g-recaptcha" aria-hidden />;
  }
);

RecaptchaV2Invisible.displayName = 'RecaptchaV2Invisible';
export default RecaptchaV2Invisible;
