import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './config';

export const cadastrarComGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    alert(`Login com Google realizado com sucesso: ${user.displayName}`);
  } catch (error) {
    console.error('Erro ao autenticar com Google:', error);
    alert('Erro ao autenticar com Google.');
  }
};
