'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

/* ===== Tipos do reCAPTCHA v2 (invisible) ===== */
type RecaptchaBadge = 'bottomright' | 'bottomleft' | 'inline';
type RecaptchaSize = 'invisible' | 'compact' | 'normal';

type RecaptchaRenderParams = {
  sitekey: string;
  size?: RecaptchaSize; // invisible
  badge?: RecaptchaBadge;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
};

type Grecaptcha = {
  render: (container: HTMLElement | string, params: RecaptchaRenderParams) => number;
  execute: (id?: number) => void;
  reset: (id?: number) => void;
  ready?: (cb: () => void) => void;
  getResponse?: (id?: number) => string;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
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
  badge?: RecaptchaBadge;
};

const SCRIPT_ID = 'recaptcha-v2-invisible-script';
const WIDGET_RENDERED_FLAG = '__recaptchaV2WidgetRendered__';

function getG(): Grecaptcha | undefined {
  return typeof window === 'undefined' ? undefined : window.grecaptcha;
}

const RecaptchaV2Invisible = forwardRef<RecaptchaV2Handle, Props>(
  ({ onVerify, siteKey, hl, badge = 'bottomright' }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<number | null>(null);
    const [ready, setReady] = useState(false);

    // fila (cada getToken() aguarda um resolver)
    const resolversRef = useRef<Array<(t: string) => void>>([]);
    const rejectersRef = useRef<Array<(e: unknown) => void>>([]);
    const watchingRef = useRef(false);

    const SITE_KEY = (siteKey?.trim() ||
      process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY ||
      '') as string;

    /** entrega o token ao próximo consumidor da fila */
    const deliverToken = useCallback(
      (token: string) => {
        const resolve = resolversRef.current.shift();
        // mantém simetria removendo também o próximo rejeitador
        rejectersRef.current.shift();
        if (resolve) resolve(token);
        if (onVerify) onVerify(token);
      },
      [onVerify]
    );

    /** falha a promessa pendente (se houver) */
    const failPending = useCallback((err: unknown) => {
      const reject = rejectersRef.current.shift();
      // mantém simetria removendo também o próximo resolvedor
      resolversRef.current.shift();
      if (reject) reject(err);
    }, []);

    /** observa o widget até o token ser gerado (ou timeout) */
    const startWatcher = useCallback(() => {
      if (watchingRef.current) return;
      watchingRef.current = true;

      const g = getG();
      const id = widgetIdRef.current ?? null;
      if (!g?.getResponse || id === null) return;

      const start = Date.now();
      const int = window.setInterval(() => {
        try {
          const t = g.getResponse!(id);
          const timedOut = Date.now() - start > 10_000;

          if (t) {
            window.clearInterval(int);
            watchingRef.current = false;
            deliverToken(t);
          } else if (timedOut) {
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
    }, [deliverToken, failPending]);

    /** renderiza o widget invisível */
    const renderWidget = useCallback(() => {
      const g = getG();
      if (!SITE_KEY || !g || !containerRef.current) return;
      if (widgetIdRef.current !== null) return;

      // evita duplicar render por navegações
      const flagHost = containerRef.current as unknown as Record<string, unknown>;
      if (flagHost[WIDGET_RENDERED_FLAG]) return;

      widgetIdRef.current = g.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: 'invisible',
        badge,
        callback: (token: string) => deliverToken(token),
        'error-callback': () => failPending(new Error('recaptcha-error')),
        'expired-callback': () => failPending(new Error('recaptcha-expired')),
      });

      flagHost[WIDGET_RENDERED_FLAG] = true;
      setReady(true);
    }, [SITE_KEY, badge, deliverToken, failPending]);

    /** carrega o script e garante o render */
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
        if ((existing.dataset as DOMStringMap).loaded === 'true') ensureRender();
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

      const onLoad = () => {
        s.dataset.loaded = 'true';
        ensureRender();
      };

      s.addEventListener('load', onLoad);
      document.body.appendChild(s);

      return () => s.removeEventListener('load', onLoad);
    }, [SITE_KEY, hl, renderWidget]);

    useImperativeHandle(
      ref,
      (): RecaptchaV2Handle => ({
        isReady: () => ready && widgetIdRef.current !== null,

        execute: () => {
          const g = getG();
          const id = widgetIdRef.current;
          if (!g || id === null) return;
          try {
            g.execute(id);
            startWatcher();
          } catch {
            /* ignore */
          }
        },

        reset: () => {
          const g = getG();
          const id = widgetIdRef.current;
          if (g && id !== null) {
            try {
              g.reset(id);
            } catch {
              /* ignore */
            }
          }
        },

        getToken: () =>
          new Promise<string>((resolve, reject) => {
            resolversRef.current.push(resolve);
            rejectersRef.current.push(reject);

            const g = getG();
            const id = widgetIdRef.current ?? undefined;

            const existing = g?.getResponse?.(id);
            if (existing) {
              deliverToken(existing);
              return;
            }

            if (g && id !== undefined) {
              try {
                g.execute(id);
                startWatcher();
              } catch (e) {
                failPending(e);
              }
              return;
            }

            // aguarda widget ficar pronto por até 8s
            const start = Date.now();
            const int = window.setInterval(() => {
              const g2 = getG();
              const ok = !!g2 && widgetIdRef.current !== null;
              const within = Date.now() - start < 8000;

              if (ok && g2) {
                window.clearInterval(int);
                try {
                  g2.execute(widgetIdRef.current!);
                  startWatcher();
                } catch (e) {
                  failPending(e);
                }
              } else if (!within) {
                window.clearInterval(int);
                failPending(new Error('recaptcha-not-ready'));
              }
            }, 120);
          }),
      }),
      [ready, startWatcher, deliverToken, failPending]
    );

    return <div ref={containerRef} className="g-recaptcha" aria-hidden />;
  }
);

RecaptchaV2Invisible.displayName = 'RecaptchaV2Invisible';
export default RecaptchaV2Invisible;
