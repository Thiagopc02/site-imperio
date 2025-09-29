import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import type { AppCheck } from 'firebase/app-check';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
    __appCheckInitialized?: boolean;
    appCheck?: AppCheck;
  }
}

export {};
