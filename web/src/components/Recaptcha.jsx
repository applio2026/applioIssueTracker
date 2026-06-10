import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Google reCAPTCHA v2 ("I'm not a robot") checkbox.
// Site key defaults to Google's public test key, which always passes and shows
// a "for testing purposes only" notice — set VITE_RECAPTCHA_SITE_KEY for production.
const SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

const SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit';
let scriptPromise = null;

// Load the reCAPTCHA API script once and resolve when grecaptcha is ready.
function loadRecaptcha() {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    script.onload = () => window.grecaptcha.ready(resolve);
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Renders the checkbox and reports the token via onChange. Parents can call
// ref.current.reset() to clear the widget after a failed submit.
const Recaptcha = forwardRef(function Recaptcha({ onChange }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        onChange('');
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadRecaptcha()
      .then(() => {
        if (cancelled || widgetIdRef.current !== null || !containerRef.current) return;
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onChange(token),
          'expired-callback': () => onChange(''),
          'error-callback': () => onChange(''),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
});

export default Recaptcha;
