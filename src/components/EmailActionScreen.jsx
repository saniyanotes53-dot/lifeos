import React, { useEffect, useState } from 'react';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../firebase';
import { Card, PrimaryButton } from './primitives';

export default function EmailActionScreen({ t }) {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const mode = params.get('mode');
  const code = params.get('oobCode');

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Checking your link…');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code || mode !== 'verifyEmail') {
      if (mode === 'resetPassword') {
        setMessage('Life OS password reset now uses a 6-digit verification code. Please open Life OS and select "Forgot password" to reset your password.');
      } else {
        setMessage('This link is incomplete or unsupported. Request a new email.');
      }
      return;
    }
    setReady(true);
    setMessage('Confirm below to verify your email address.');
  }, [code, mode]);

  async function submit(e) {
    e.preventDefault();
    if (busy || !code) return;
    setBusy(true);
    try {
      await applyActionCode(auth, code);
      setDone(true);
      setMessage('Email verified. Welcome to Life OS.');
      window.history.replaceState({}, '', '/auth/action');
    } catch {
      setMessage('This link could not be used. Request a new verification email and try the newest link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: t.bg, color: t.text }}>
      <Card t={t} style={{ width: '100%', maxWidth: 440 }}>
        <h1>{mode === 'resetPassword' ? 'Password Reset' : 'Verify your email'}</h1>
        <p role="status">{message}</p>
        {ready && !done && (
          <form onSubmit={submit}>
            <PrimaryButton t={t} type="submit" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify email'}
            </PrimaryButton>
          </form>
        )}
        <p style={{ marginTop: 16 }}>
          <a href="/" style={{ color: t.a1, textDecoration: 'none', fontWeight: 600 }}>
            {done ? 'Open Life OS' : 'Return to Life OS'}
          </a>
        </p>
      </Card>
    </div>
  );
}
