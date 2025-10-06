'use client';

import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useRef, useState
} from 'react';

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement | string, params: any) => number;
      execute: (id?: number) => void;
      reset: (id?: number) => void;
      ready?: (cb: () => void) => void;
      getResponse?: (id?: number) => string;
    };
    __recaptchaV2ScriptLoaded__?: boolean;
  }
}

export type RecaptchaV2Handle = {
  /** dispara o desafio (não resolve token) */
  execute: () => void;
  /** zera o widget */
  reset: () => void;
  /** indica se já foi renderizado */
  isReady: () => boolean;
  /** dispara e resolve o token (forma recomendada) */
  getToken: () => Promise<string>;
};

type Props = {
  /** opcional: callback adicional quando um token válido é obtido */
  onVerify?: (token: string) => void;
  siteKey?: string;
  hl?: string;
  badge?: 'bottomright' | 'bottomleft' | 'inline';
};

const SCRIPT_ID = 'recaptcha-v2-invisible-script';
const WIDGET_RENDERED_FLAG = '__recaptchaV2WidgetRendered__';

function getG() { return typeof window === 'undefined' ? undefined : window.grecaptcha; }

const RecaptchaV2Invisible = forwardRef<RecaptchaV2Handle, Props>(
  ({ onVerify, siteKey, hl, badge = 'bottomright' }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<number | null>(null);
    const [ready, setReady] = useState(false);

    // fila (cada getToken() aguarda um resolver)
    const resolversRef = useRef<((t: string) => void)[]>([]);
    const rejectersRef = useRef<((e: any) => void)[]>([]);
    const watchingRef = useRef(false);

    const SITE_KEY =
      (siteKey?.trim() || process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY || '') as string;

    const deliverToken = (token: string) => {
      const r = resolversRef.current.shift();
      const rej = rejectersRef.current.shift(); // manter simetria
      rej; // (no-op)
      r?.(token);
      onVerify?.(token);
    };

    const failPending = (err: any) => {
      const rej = rejectersRef.current.shift();
      resolversRef.current.shift(); // manter simetria
      rej?.(err);
    };

    const startWatcher = () => {
      if (watchingRef.current) return;
      watchingRef.current = true;
      const g = getG();
      const id = widgetIdRef.current!;
      if (!g?.getResponse) return;

      const start = Date.now();
      const int = window.setInterval(() => {
        try {
          const t = g.getResponse!(id);
          if (t) {
            window.clearInterval(int);
            watchingRef.current = false;
            deliverToken(t);
          } else if (Date.now() - start > 10000) {
            window.clearInterval(int);
            watchingRef.current = false;
            failPending(new Error('recaptcha-timeout'));
          }
        } catch (e) {
          window.clearInterval(int);
          watchingRef.current = false;
          failPending(e);
        }
      }, 120);
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
        callback: (token: string) => deliverToken(token),
        'error-callback': () => failPending(new Error('recaptcha-error')),
        'expired-callback': () => failPending(new Error('recaptcha-expired')),
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
        if (g?.ready) g.ready(renderWidget); else renderWidget();
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

      const base = 'https://www.google.com/recaptcha/api.js';
      const qs = new URLSearchParams({ render: 'explicit' });
      if (hl) qs.set('hl', hl);

      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.async = true;
      s.defer = true;
      s.src = `${base}?${qs.toString()}`;
      const onLoad = () => { (s as any).dataset.loaded = 'true'; ensureRender(); };
      s.addEventListener('load', onLoad);
      document.body.appendChild(s);

      return () => s.removeEventListener('load', onLoad);
    }, [SITE_KEY, hl, renderWidget]);

    useImperativeHandle(ref, (): RecaptchaV2Handle => ({
      isReady: () => ready && widgetIdRef.current !== null,

      execute: () => {
        const g = getG();
        const id = widgetIdRef.current;
        if (!g || id === null) return;
        try { g.execute(id); startWatcher(); } catch { /* ignore */ }
      },

      reset: () => {
        const g = getG();
        const id = widgetIdRef.current;
        if (g && id !== null) { try { g.reset(id); } catch { /* ignore */ } }
      },

      getToken: () =>
        new Promise<string>((resolve, reject) => {
          resolversRef.current.push(resolve);
          rejectersRef.current.push(reject);

          const g = getG();
          const id = widgetIdRef.current;

          const t = g?.getResponse?.(id!);
          if (t) { deliverToken(t); return; }

          if (g && id !== null) {
            try { g.execute(id); startWatcher(); } catch (e) { failPending(e); }
          } else {
            const start = Date.now();
            const int = window.setInterval(() => {
              const g2 = getG();
              const ok = g2 && widgetIdRef.current !== null;
              const within = Date.now() - start < 8000;
              if (ok && g2) {
                window.clearInterval(int);
                try { g2.execute(widgetIdRef.current!); startWatcher(); }
                catch (e) { failPending(e); }
              } else if (!within) {
                window.clearInterval(int);
                failPending(new Error('recaptcha-not-ready'));
              }
            }, 120);
          }
        }),
    }), [ready]);

    return <div ref={containerRef} className="g-recaptcha" aria-hidden />;
  }
);

RecaptchaV2Invisible.displayName = 'RecaptchaV2Invisible';
export default RecaptchaV2Invisible;
